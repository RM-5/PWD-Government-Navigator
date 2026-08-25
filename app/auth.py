from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from models.schema import CitizenProfile, HospitalStaff, RoleName, StateRepresentative, User


def _extract_demo_email(authorization: str | None, x_demo_user: str | None) -> str:
    if x_demo_user:
        return x_demo_user.strip().lower()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip().lower()
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Use X-Demo-User or Authorization: Bearer <demo email>",
    )


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
    x_demo_user: Annotated[str | None, Header()] = None,
) -> User:
    email = _extract_demo_email(authorization, x_demo_user)
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown or inactive demo user")
    return user


def has_role(user: User, role: RoleName) -> bool:
    return any(user_role.name == role for user_role in user.roles)


def require_roles(*allowed_roles: RoleName):
    def dependency(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if not any(has_role(current_user, role) for role in allowed_roles):
            allowed = ", ".join(role.value for role in allowed_roles)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires one of: {allowed}")
        return current_user

    return dependency


def current_citizen_profile(db: Session, user: User) -> CitizenProfile:
    profile = db.scalar(select(CitizenProfile).where(CitizenProfile.user_id == user.id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current user has no citizen profile")
    return profile


def current_hospital_staff(db: Session, user: User) -> HospitalStaff:
    staff = db.scalar(select(HospitalStaff).where(HospitalStaff.user_id == user.id, HospitalStaff.active.is_(True)))
    if staff is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current user is not active hospital staff")
    return staff


def current_state_representative(db: Session, user: User) -> StateRepresentative:
    representative = db.scalar(
        select(StateRepresentative).where(StateRepresentative.user_id == user.id, StateRepresentative.active.is_(True))
    )
    if representative is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current user is not an active state representative")
    return representative
