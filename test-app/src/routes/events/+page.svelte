<script lang="ts">
	import { eventsStore } from '$lib/stores.svelte'

	// biome-ignore lint/style/useConst: Svelte 5 $state needs let for reassignments in event handlers
	let filter = $state('')
	let currentPage = $state(1)
	const EVENTS_PER_PAGE = 50

	const filteredEvents = $derived(
		eventsStore.value.filter(event => 
			filter === '' || event.type.includes(filter)
		)
	)

	const totalPages = $derived(Math.ceil(filteredEvents.length / EVENTS_PER_PAGE))
	
	const paginatedEvents = $derived(
		filteredEvents.slice(
			(currentPage - 1) * EVENTS_PER_PAGE,
			currentPage * EVENTS_PER_PAGE
		)
	)

	const eventTypes = $derived(
		[...new Set(eventsStore.value.map(e => e.type))].slice(0, 20) // Limit event type filters
	)

	function clearEvents() {
		eventsStore.clear()
		currentPage = 1
	}

	function setFilter(newFilter: string) {
		filter = newFilter
		currentPage = 1
	}

	function nextPage() {
		if (currentPage < totalPages) currentPage++
	}

	function prevPage() {
		if (currentPage > 1) currentPage--
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString()
	}

	function getEventIcon(type: string): string {
		if (type.includes('message')) return '📨'
		if (type.includes('chat')) return '💬'
		if (type.includes('contact')) return '👤'
		if (type.includes('group')) return '👥'
		if (type.includes('connection')) return '🔌'
		return '📝'
	}

	function getEventColor(type: string): string {
		if (type.includes('message')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
		if (type.includes('chat')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
		if (type.includes('contact')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
		if (type.includes('group')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
		return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Event Log</h2>
			<p class="text-gray-500 dark:text-gray-400">
				Real-time Baileys events ({filteredEvents.length} events
				{#if filter !== ''} - filtered{/if})
			</p>
		</div>
		<button 
			onclick={clearEvents}
			class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer transition-colors"
		>
			Clear All
		</button>
	</div>

	<!-- Filters -->
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
		<div class="flex flex-wrap gap-2">
			<button
				onclick={() => setFilter('')}
				class="px-3 py-1 rounded-full text-sm cursor-pointer transition-colors {filter === '' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
			>
				All
			</button>
			{#each eventTypes as type}
				<button
					onclick={() => setFilter(type)}
					class="px-3 py-1 rounded-full text-sm cursor-pointer transition-colors {filter === type ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
				>
					{type}
				</button>
			{/each}
		</div>
	</div>

	<!-- Events List -->
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
		{#if filteredEvents.length === 0}
			<div class="p-8 text-center">
				<span class="text-6xl mb-4 block">📝</span>
				<p class="text-gray-500 dark:text-gray-400">No events recorded yet</p>
				<p class="text-sm text-gray-400 dark:text-gray-500 mt-2">Events will appear here in real-time</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each paginatedEvents as event}
					<div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
						<div class="flex items-start justify-between">
							<div class="flex items-start space-x-3">
								<span class="text-xl mt-0.5">{getEventIcon(event.type)}</span>
								<div>
									<div class="flex items-center space-x-2">
										<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventColor(event.type)}`}>
											{event.type}
										</span>
										<span class="text-xs text-gray-500 dark:text-gray-400">
											{formatTime(event.timestamp)}
										</span>
									</div>
									{#if event.data}
										<details class="mt-2">
											<summary class="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
												View data
											</summary>
											<pre class="mt-2 p-2 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded text-xs overflow-x-auto max-h-40">{JSON.stringify(event.data, null, 2)}</pre>
										</details>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="border-t border-gray-200 dark:border-gray-700 p-4">
					<div class="flex items-center justify-between">
						<button
							onclick={prevPage}
							disabled={currentPage === 1}
							class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							← Previous
						</button>
						<span class="text-sm text-gray-600 dark:text-gray-400">
							Page {currentPage} of {totalPages}
						</span>
						<button
							onclick={nextPage}
							disabled={currentPage === totalPages}
							class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							Next →
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
