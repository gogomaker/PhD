import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 연결 없이도 앱이 열리게: 빌드한 파일 목록을 asset-list.json으로 낸다 → 서비스 워커가 미리 받아 둔다 (2026-10-03 UT 4차).
// 글꼴(woff2)은 많아서 빼고, 쓰는 것만 처음 쓸 때 받아 둔다
function assetList(): Plugin {
  return {
    name: 'phd-asset-list',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(f => !f.endsWith('.map') && !f.endsWith('.woff2') && f !== 'index.html').map(f => '/' + f);
      this.emitFile({ type: 'asset', fileName: 'asset-list.json', source: JSON.stringify(files) });
    },
  };
}

export default defineConfig({
  plugins: [react(), assetList()],
});
