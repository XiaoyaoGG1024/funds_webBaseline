import { createRouter, createWebHistory } from 'vue-router'

import FundGraph from '../views/FundGraph.vue'


const routes = [
  {
    path: '/',
    name: 'FundGraph',
    component: FundGraph
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router