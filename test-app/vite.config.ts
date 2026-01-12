import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 3000
	},
	ssr: {
		noExternal: ['@rodrigogs/baileys-store']
	},
	optimizeDeps: {
		include: ['@rodrigogs/baileys-store']
	}
})
