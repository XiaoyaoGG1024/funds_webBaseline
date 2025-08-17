<template>
  <div id="app">
    <header class="app-header">
      <h1>资金流向可视化系统</h1>
    </header>
    <main class="app-main">
      <router-view />
      <SummaryTable />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App',
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Microsoft YaHei', sans-serif;
  background-color: #f5f5f5;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.app-header h1 {
  font-size: 1.5rem;
  font-weight: 500;
}

.app-main {
  flex: 1;
  padding: 2rem;
}
</style>