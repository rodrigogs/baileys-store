<script lang="ts">
	import '../app.css'
	import { onMount } from 'svelte'
	import { connectionStore, statsStore, eventsStore } from '$lib/stores.svelte'
	import type { ConnectionState, StoreStats, BaileysEvent } from '$lib/types'

	const { children } = $props()

	// SSE connection
	onMount(() => {
		const eventSource = new EventSource('/api/events')

		eventSource.addEventListener('connection', (e) => {
			const data = JSON.parse(e.data) as ConnectionState
			connectionStore.set(data)
		})

		eventSource.addEventListener('qr', (e) => {
			const { qr } = JSON.parse(e.data)
			connectionStore.update({ qrCode: qr })
		})

		eventSource.addEventListener('stats', (e) => {
			const data = JSON.parse(e.data) as StoreStats
			statsStore.set(data)
		})

		eventSource.addEventListener('event', (e) => {
			const data = JSON.parse(e.data) as BaileysEvent
			eventsStore.add(data)
		})

		eventSource.onerror = () => {
			connectionStore.update({ status: 'error', error: 'Lost connection to server' })
		}

		return () => eventSource.close()
	})

	const navItems = [
		{ href: '/', label: 'Store Inspector', icon: '🔍' },
		{ href: '/events', label: 'Events Log', icon: '📝' }
	]

	const statusColors: Record<string, string> = {
		disconnected: 'bg-gray-400',
		connecting: 'bg-yellow-400 animate-pulse',
		connected: 'bg-green-500',
		error: 'bg-red-500'
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<!-- Header -->
	<header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<div class="flex items-center space-x-3">
					<span class="text-2xl">🤖</span>
					<h1 class="text-xl font-bold text-gray-900 dark:text-white">Baileys Store Test</h1>
				</div>
				<div class="flex items-center space-x-4">
					<div class="flex items-center space-x-2">
						<span class={`w-3 h-3 rounded-full ${statusColors[connectionStore.value.status]}`}></span>
						<span class="text-sm text-gray-600 dark:text-gray-300 capitalize">
							{connectionStore.value.status}
						</span>
					</div>
					{#if connectionStore.value.user}
						<span class="text-sm text-gray-500 dark:text-gray-400">
							{connectionStore.value.user.name || connectionStore.value.user.id}
						</span>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<div class="flex">
		<!-- Sidebar Navigation -->
		<nav class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-4rem)]">
			<ul class="p-4 space-y-2">
				{#each navItems as item}
					<li>
						<a 
							href={item.href}
							class="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							<span class="text-xl">{item.icon}</span>
							<span class="font-medium">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>

			<!-- Quick Stats -->
			<div class="p-4 border-t border-gray-200 dark:border-gray-700">
				<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
					Store Data
				</h3>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between text-gray-600 dark:text-gray-300">
						<span>Chats</span>
						<span class="font-medium">{statsStore.value.totalChats}</span>
					</div>
					<div class="flex justify-between text-gray-600 dark:text-gray-300">
						<span>Contacts</span>
						<span class="font-medium">{statsStore.value.totalContacts}</span>
					</div>
					<div class="flex justify-between text-gray-600 dark:text-gray-300">
						<span>Messages</span>
						<span class="font-medium">{statsStore.value.totalMessages}</span>
					</div>
				</div>
			</div>
		</nav>

		<!-- Main Content -->
		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>
</div>
