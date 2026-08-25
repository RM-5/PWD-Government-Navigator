import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { navy:'#12304a', teal:'#087e8b', mint:'#e7f5f2', ink:'#152533' } } }, plugins: [] };
export default config;
