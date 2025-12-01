export interface Blop {
  id: string
  x: number
  y: number
  shape: "circle" | "square" | "pill" | "diamond"
  color: string
  content: string
  type: "text" | "link" | "url" | "file" | "image" | "embed"
  tags?: string[]
  connections?: string[]
}

export interface Website {
  id: string
  url: string
  name: string
  techStack: {
    frontend: string
    backend: string
    hosting: string
    analytics: string
    payments: string
  }
  linkedBlops?: string[]
  subscriptionIds?: string[]
}

export interface Subscription {
  id: string
  name: string
  cost: number
  period: "monthly" | "annual"
  renewalDate: string
  category: string
  website?: string
}

export interface Property {
  id: string
  address: string
  type: string
  status: "Active" | "Rented" | "Sold" | "Maintenance"
  value: number
  tasks: number
  linkedWebsites?: string[]
}

export interface Client {
  id: string
  name: string
  status: string
  contacts: number
  websites: number
  tasks: number
}


