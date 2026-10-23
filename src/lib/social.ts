// รายการแพลตฟอร์มโซเชียล (always = แสดงไอคอนท้ายเว็บเสมอ แม้ยังไม่ใส่ลิงก์)
import { labels } from './site';

export const platforms = [
  { key: 'facebook', name: labels.socialFacebook, always: true },
  { key: 'youtube', name: labels.socialYoutube, always: true },
  { key: 'discord', name: labels.socialDiscord, always: true },
  { key: 'instagram', name: labels.socialInstagram, always: false },
  { key: 'line', name: labels.socialLine, always: false },
] as const;
