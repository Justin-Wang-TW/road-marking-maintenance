import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // 讀取環境變數
    const env = loadEnv(mode, '.', '');
    
    return {
      // 關鍵修正：設定基礎路徑，確保 GitHub Pages 能正確找到靜態資源
      base: '/KEELUNG-PARKING-PCM/',
      
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // 保持你原本的 API_KEY 設定
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // 保持你原本的別名設定
          '@': path.resolve('.'),
        }
      }
    };
});