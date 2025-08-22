import { ref } from 'vue'
import { fundApi } from '../api'

export function useSearch() {
  const searchKeyword = ref('')
  const searchSuggestions = ref([])
  const isSearching = ref(false)
  const searchHistory = ref(JSON.parse(localStorage.getItem('searchHistory') || '[]'))
  const searchedCardIds = ref(new Set())

  function debounce(func, delay) {
    let timeoutId
    return function (...args) {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func.apply(this, args), delay)
    }
  }

  const debounceSearch = debounce((keyword) => {
    if (keyword.trim().length >= 2) {
      performRealTimeSearch(keyword)
    } else {
      searchSuggestions.value = []
    }
  }, 300)

  const performRealTimeSearch = async (keyword) => {
    if (isSearching.value) return
    
    try {
      isSearching.value = true
      const response = await fundApi.searchNode(keyword)
      const suggestions = response.data || response || []
      searchSuggestions.value = suggestions.slice(0, 10)
    } catch (error) {
      console.error('实时搜索失败:', error)
      searchSuggestions.value = []
    } finally {
      isSearching.value = false
    }
  }

  const onSearchInput = (e) => {
    const keyword = e.target.value
    debounceSearch(keyword)
  }

  const clearSearch = () => {
    searchKeyword.value = ''
    searchSuggestions.value = []
    searchedCardIds.value.clear()
  }

  return {
    searchKeyword,
    searchSuggestions,
    isSearching,
    searchHistory,
    searchedCardIds,
    onSearchInput,
    performRealTimeSearch,
    clearSearch
  }
}