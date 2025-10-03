// vimeoConfig.ts
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
dotenv.config();
console.log('VIMEO_ACCESS_TOKEN:', process.env.VIMEO_ACCESS_TOKEN);

const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

if (!VIMEO_ACCESS_TOKEN) {
  throw new Error('VIMEO_ACCESS_TOKEN environment variable is not set.');
}
// Create a new axios instance
const vimeoAPI: AxiosInstance = axios.create({
  baseURL: 'https://api.vimeo.com',
  headers: {
    'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export default vimeoAPI;
