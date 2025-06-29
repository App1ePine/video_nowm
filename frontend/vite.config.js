import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import compress from 'vite-plugin-compression'
// https://vite.dev/config/
export default defineConfig((command, mode) => {
	const env = loadEnv(mode, process.cwd(), '')
	const isDev = mode === 'development'
	return {
		plugins: [
			vue(),
			AutoImport({
				resolvers: [
					ElementPlusResolver({
						importStyle: 'css',
					}),
				],
				imports: ['vue'],
				dts: 'src/auto-imports.d.ts',
			}),
			Components({
				resolvers: [
					ElementPlusResolver({
						importStyle: 'css',
					}),
				],
				dts: 'src/components.d.ts',
			}),
			compress({
				verbose: true,
				disable: false,
				threshold: 10240,
				algorithm: 'gzip',
				ext: '.gz',
			}),
		],
		server: {
			proxy: {
				'/api': {
					target: 'http://localhost:30001',
					changeOrigin: true,
				},
			},
		},
		build: {
			cssCodeSplit: true,
			minify: 'terser',
			terserOptions: {
				compress: {
					drop_console: true,
					drop_debugger: true,
				},
			},
			optimizeDeps: {
				include: ['vue', 'element-plus', 'axios'],
			},
			rollupOptions: {
				output: {
					manualChunks(id) {
						// 基础库分包
						if (id.includes('node_modules')) {
							if (id.includes('element-plus')) {
								return 'element-plus'
							} else if (id.includes('vue') || id.includes('@vue')) {
								return 'vue-vendor'
							} else if (id.includes('axios')) {
								return 'axios'
							}
						} else {
							return 'vendor'
						}
					},
					// 控制打包文件目录
					chunkFileNames: 'assets/js/[name]-[hash].js',
					entryFileNames: 'assets/js/[name]-[hash].js',
					assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
				},
			},
			brotliSize: true,
			chunkSizeWarningLimit: 500,
		},
	}
})
