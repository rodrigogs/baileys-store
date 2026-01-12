<script lang="ts">
	import { connectionStore, statsStore } from '$lib/stores.svelte'
	import type { StoreAnalysis } from '$lib/types'

	let loading = $state(false)
	let message = $state('')
	let selectedVersion = $state<'6' | '7'>(connectionStore.value.selectedBaileysVersion || '6')
	let switchingVersion = $state(false)
	let storeAnalysis = $state<StoreAnalysis | null>(null)
	let loadingAnalysis = $state(false)
	let showRawData = $state(false)
	// biome-ignore lint/suspicious/noExplicitAny: Raw store data structure is dynamic
	let rawStoreData = $state<any>(null)

	async function connect() {
		loading = true
		message = ''
		try {
			const res = await fetch('/api/connection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'connect' })
			})
			const data = await res.json()
			message = data.message
		} catch (err) {
			message = 'Failed to connect'
		}
		loading = false
	}

	async function disconnect() {
		loading = true
		try {
			const res = await fetch('/api/connection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'disconnect' })
			})
			const data = await res.json()
			message = data.message
		} catch (err) {
			message = 'Failed to disconnect'
		}
		loading = false
	}

	async function clearSession() {
		if (!confirm('This will clear all session data and you will need to scan the QR code again. Continue?')) return
		loading = true
		try {
			const res = await fetch('/api/connection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'clear' })
			})
			const data = await res.json()
			message = data.message
		} catch (err) {
			message = 'Failed to clear session'
		}
		loading = false
	}

	async function logout() {
		if (!confirm('This will clear all session data. Continue?')) return
		loading = true
		try {
			const res = await fetch('/api/connection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'logout' })
			})
			const data = await res.json()
			message = data.message
		} catch (err) {
			message = 'Failed to logout'
		}
		loading = false
	}

	async function setBaileysVersion(version: '6' | '7') {
		if (connectionStore.value.status !== 'disconnected') {
			message = 'Disconnect before changing Baileys version'
			return
		}
		switchingVersion = true
		try {
			const res = await fetch('/api/baileys-version', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ version })
			})
			const data = await res.json()
			if (data.success) {
				selectedVersion = version
				message = `Switched to Baileys v${version}`
			}
		} catch (err) {
			message = 'Failed to switch Baileys version'
		}
		switchingVersion = false
	}

	async function analyzeStore() {
		loadingAnalysis = true
		try {
			const res = await fetch('/api/store?analyze=true')
			storeAnalysis = await res.json()
		} catch (err) {
			message = 'Failed to analyze store'
		}
		loadingAnalysis = false
	}

	async function loadRawStoreData() {
		showRawData = !showRawData
		if (showRawData && !rawStoreData) {
			try {
				const res = await fetch('/api/status')
				rawStoreData = await res.json()
			} catch (err) {
				message = 'Failed to load raw store data'
			}
		}
	}

	async function clearStoreData() {
		if (!confirm('This will delete ALL stored data (chats, contacts, messages). Authentication will remain. Continue?')) return
		loading = true
		try {
			const res = await fetch('/api/clear-store', {
				method: 'POST'
			})
			const data = await res.json()
			message = data.message
			// Reset analysis and raw data views
			storeAnalysis = null
			rawStoreData = null
			showRawData = false
		} catch (err) {
			message = 'Failed to clear store data'
		}
		loading = false
	}

	const hasSession = $derived(connectionStore.value.hasSession === true)
	const isDisconnected = $derived(connectionStore.value.status === 'disconnected' || connectionStore.value.status === 'error')
	const isConnected = $derived(connectionStore.value.status === 'connected')
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Store Inspector</h2>
		<p class="text-gray-500 dark:text-gray-400">Test and inspect the @rodrigogs/baileys-store library</p>
	</div>

	<!-- Connection Card -->
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connection Control</h3>
		
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Status Section -->
			<div>
				{#if connectionStore.value.status === 'connected' && connectionStore.value.user}
					<div class="flex items-center space-x-4 mb-4">
						<div class="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
							<span class="text-2xl">✅</span>
						</div>
						<div>
							<p class="font-medium text-gray-900 dark:text-white">
								{connectionStore.value.user.name || 'WhatsApp User'}
							</p>
							<p class="text-sm text-gray-500 dark:text-gray-400">
								{connectionStore.value.user.id}
							</p>
							{#if connectionStore.value.baileysVersion}
								<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
									Baileys v{connectionStore.value.baileysVersion}
								</p>
							{/if}
						</div>
					</div>
					<div class="flex space-x-3">
						<button
							onclick={disconnect}
							disabled={loading}
							class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm"
						>
							Disconnect
						</button>
						<button
							onclick={logout}
							disabled={loading}
							class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
						>
							Logout
						</button>
					</div>
				{:else if connectionStore.value.status === 'connecting'}
					<div class="flex items-center space-x-3 mb-4">
						<div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
						<span class="text-gray-600 dark:text-gray-300">Connecting...</span>
					</div>
					{#if connectionStore.value.baileysVersion}
						<p class="text-xs text-gray-400 dark:text-gray-500">
							Using Baileys v{connectionStore.value.baileysVersion}
						</p>
					{/if}
				{:else if connectionStore.value.status === 'error'}
					<div class="flex items-center space-x-3 mb-4 text-red-500">
						<span class="text-2xl">❌</span>
						<span>{connectionStore.value.error || 'Connection error'}</span>
					</div>
				{:else}
					<div class="flex items-center space-x-3 mb-4 text-gray-500 dark:text-gray-400">
						<span class="text-2xl">📴</span>
						<span>Not connected</span>
					</div>
					
					<!-- Version Selector -->
					<div class="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
						<div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Baileys Version
						</div>
						<div class="flex space-x-2">
							<button
								onclick={() => setBaileysVersion('6')}
								disabled={switchingVersion || selectedVersion === '6'}
								class="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors
									{selectedVersion === '6' 
										? 'bg-blue-600 text-white' 
										: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
									disabled:opacity-50 disabled:cursor-not-allowed"
							>
								v6 (Stable)
							</button>
							<button
								onclick={() => setBaileysVersion('7')}
								disabled={switchingVersion || selectedVersion === '7'}
								class="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors
									{selectedVersion === '7' 
										? 'bg-blue-600 text-white' 
										: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}
									disabled:opacity-50 disabled:cursor-not-allowed"
							>
								v7 (RC)
							</button>
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
							Switch version before connecting
						</p>
					</div>
					
					<!-- Connect Buttons -->
					{#if hasSession}
						<div class="flex space-x-3">
							<button
								onclick={connect}
								disabled={loading}
								class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
							>
								{loading ? 'Reconnecting...' : 'Reconnect'}
							</button>
							<button
								onclick={clearSession}
								disabled={loading}
								class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
							>
								Clear
							</button>
						</div>
					{:else}
						<button
							onclick={connect}
							disabled={loading}
							class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
						>
							{loading ? 'Connecting...' : 'Connect'}
						</button>
					{/if}
				{/if}

				{#if message}
					<p class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm">
						{message}
					</p>
				{/if}
			</div>

			<!-- QR Code Section -->
			<div>
				{#if connectionStore.value.qrCode}
					<div class="bg-white dark:bg-gray-900 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700">
						<p class="text-sm text-gray-600 dark:text-gray-400 mb-3 text-center">Scan with WhatsApp</p>
						<img src={connectionStore.value.qrCode} alt="QR Code" class="w-full" />
					</div>
				{:else}
					<div class="h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
						<div class="text-center">
							<span class="text-4xl mb-2 block">📱</span>
							<p class="text-sm">QR code will appear here</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Store Statistics -->
	{#if isConnected}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-500 dark:text-gray-400">Chats Stored</p>
						<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{statsStore.value.totalChats}</p>
					</div>
					<div class="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
						<span class="text-2xl">💬</span>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-500 dark:text-gray-400">Contacts Stored</p>
						<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{statsStore.value.totalContacts}</p>
					</div>
					<div class="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
						<span class="text-2xl">👥</span>
					</div>
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-500 dark:text-gray-400">Messages Stored</p>
						<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{statsStore.value.totalMessages}</p>
					</div>
					<div class="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
						<span class="text-2xl">📨</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Store Analysis -->
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Store Analysis</h3>
				<div class="flex space-x-2">
					<button
						onclick={clearStoreData}
						disabled={loading}
						class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
					>
						Clear Store Data
					</button>
					<button
						onclick={analyzeStore}
						disabled={loadingAnalysis}
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
					>
						{loadingAnalysis ? 'Analyzing...' : 'Analyze Store'}
					</button>
				</div>
			</div>

			{#if storeAnalysis}
				<div class="space-y-6">
					<!-- Overview -->
					<div>
						<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Overview</h4>
						<div class="grid grid-cols-3 gap-4">
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Total Chats</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.overview.totalChats}</p>
							</div>
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Total Contacts</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.overview.totalContacts}</p>
							</div>
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Total Messages</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.overview.totalMessages}</p>
							</div>
						</div>
					</div>

					<!-- Chat Breakdown -->
					<div>
						<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Chat Breakdown</h4>
						<div class="grid grid-cols-3 gap-4">
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Groups</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.chatBreakdown.groups}</p>
							</div>
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Individuals</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.chatBreakdown.individuals}</p>
							</div>
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Archived</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.chatBreakdown.archived}</p>
							</div>
						</div>
					</div>

					<!-- Message Breakdown -->
					<div>
						<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Message Breakdown</h4>
						<div class="grid grid-cols-4 gap-4">
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Sent</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.messageBreakdown.sent}</p>
							</div>
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Received</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.messageBreakdown.received}</p>
							</div>
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Text</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.messageBreakdown.text}</p>
							</div>
							<div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
								<p class="text-xs text-gray-500 dark:text-gray-400">Media</p>
								<p class="text-xl font-bold text-gray-900 dark:text-white">{storeAnalysis.messageBreakdown.media}</p>
							</div>
						</div>
					</div>

					<!-- Data Quality -->
					<div>
						<h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Data Quality</h4>
						<div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
							<div class="flex items-center justify-between mb-3">
								<span class="text-sm text-gray-600 dark:text-gray-400">Quality Score</span>
								<span class="text-2xl font-bold {storeAnalysis.dataQuality.score >= 80 ? 'text-green-600' : storeAnalysis.dataQuality.score >= 50 ? 'text-yellow-600' : 'text-red-600'}">
									{storeAnalysis.dataQuality.score}%
								</span>
							</div>
							{#if storeAnalysis.dataQuality.issues.length > 0}
								<div class="space-y-2">
									<p class="text-xs font-semibold text-gray-600 dark:text-gray-400">Issues:</p>
									{#each storeAnalysis.dataQuality.issues as issue}
										<p class="text-xs text-gray-600 dark:text-gray-300 flex items-start">
											<span class="mr-2">⚠️</span>
											<span>{issue}</span>
										</p>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-green-600 dark:text-green-400">✅ No issues detected</p>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<p class="text-gray-500 dark:text-gray-400 text-center py-8">Click "Analyze Store" to inspect store data quality and structure</p>
			{/if}
		</div>

		<!-- Raw Store Data -->
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Raw Store Data</h3>
				<button
					onclick={loadRawStoreData}
					class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
				>
					{showRawData ? 'Hide' : 'Show'} Raw Data
				</button>
			</div>

			{#if showRawData && rawStoreData}
				<div class="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
					<pre class="text-xs text-green-400 font-mono">{JSON.stringify(rawStoreData, null, 2)}</pre>
				</div>
			{:else if showRawData}
				<p class="text-gray-500 dark:text-gray-400 text-center py-4">Loading raw data...</p>
			{/if}
		</div>
	{/if}
</div>
