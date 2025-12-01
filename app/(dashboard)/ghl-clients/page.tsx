"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Users, TrendingUp, Eye, UserPlus, DollarSign, Filter } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { GoHighLevelClient, ClientMetrics, SubscriptionPlan } from "@/types/gohighlevel"
import { GHLClientCard } from "@/components/ghl/client-card"
import { GHLClientModal } from "@/components/ghl/client-modal"
import { GHLStats } from "@/components/ghl/stats"

// Mock data - replace with real API calls
const mockClients: GoHighLevelClient[] = [
  {
    id: "1",
    name: "Acme Marketing",
    email: "contact@acme.com",
    phone: "+1-555-0101",
    company: "Acme Marketing LLC",
    subscriptionPlan: "professional",
    affiliateUserId: "user_123",
    createdAt: "2024-01-15",
    updatedAt: "2024-11-30",
    status: "active",
  },
  {
    id: "2",
    name: "Tech Startup Inc",
    email: "hello@techstartup.com",
    phone: "+1-555-0102",
    company: "Tech Startup Inc",
    subscriptionPlan: "agency",
    affiliateUserId: "user_123",
    createdAt: "2024-02-20",
    updatedAt: "2024-11-30",
    status: "active",
  },
  {
    id: "3",
    name: "Local Business Co",
    email: "info@localbiz.com",
    subscriptionPlan: "starter",
    affiliateUserId: "user_456",
    createdAt: "2024-03-10",
    updatedAt: "2024-11-30",
    status: "active",
  },
]

const mockMetrics: Record<string, ClientMetrics> = {
  "1": {
    clientId: "1",
    currentWeek: {
      clientId: "1",
      weekStart: "2024-11-25",
      weekEnd: "2024-12-01",
      views: 1247,
      leads: 34,
      conversions: 12,
      revenue: 3400,
    },
    lastWeek: {
      clientId: "1",
      weekStart: "2024-11-18",
      weekEnd: "2024-11-24",
      views: 1156,
      leads: 28,
      conversions: 10,
      revenue: 2800,
    },
    thisMonth: {
      views: 5234,
      leads: 142,
      conversions: 48,
      revenue: 14200,
    },
    allTime: {
      views: 45678,
      leads: 1234,
      conversions: 456,
      revenue: 123400,
    },
  },
  "2": {
    clientId: "2",
    currentWeek: {
      clientId: "2",
      weekStart: "2024-11-25",
      weekEnd: "2024-12-01",
      views: 2341,
      leads: 67,
      conversions: 23,
      revenue: 6700,
    },
    lastWeek: {
      clientId: "2",
      weekStart: "2024-11-18",
      weekEnd: "2024-11-24",
      views: 2156,
      leads: 59,
      conversions: 20,
      revenue: 5900,
    },
    thisMonth: {
      views: 9876,
      leads: 289,
      conversions: 98,
      revenue: 28900,
    },
    allTime: {
      views: 78901,
      leads: 2345,
      conversions: 789,
      revenue: 234500,
    },
  },
  "3": {
    clientId: "3",
    currentWeek: {
      clientId: "3",
      weekStart: "2024-11-25",
      weekEnd: "2024-12-01",
      views: 456,
      leads: 12,
      conversions: 4,
      revenue: 1200,
    },
    lastWeek: {
      clientId: "3",
      weekStart: "2024-11-18",
      weekEnd: "2024-11-24",
      views: 389,
      leads: 9,
      conversions: 3,
      revenue: 900,
    },
    thisMonth: {
      views: 1890,
      leads: 45,
      conversions: 15,
      revenue: 4500,
    },
    allTime: {
      views: 12345,
      leads: 312,
      conversions: 98,
      revenue: 31200,
    },
  },
}

export default function GHLClientsPage() {
  const { user } = useUser()
  const [clients, setClients] = useState<GoHighLevelClient[]>(mockClients)
  const [selectedClient, setSelectedClient] = useState<GoHighLevelClient | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filter, setFilter] = useState<"all" | "mine">("mine")

  // Filter clients based on affiliate user
  const filteredClients = filter === "mine" 
    ? clients.filter(c => c.affiliateUserId === user?.id)
    : clients

  // Calculate affiliate stats
  const myClients = clients.filter(c => c.affiliateUserId === user?.id)
  const totalRevenue = myClients.reduce((sum, client) => {
    const metrics = mockMetrics[client.id]
    return sum + (metrics?.allTime.revenue || 0)
  }, 0)
  const monthlyRevenue = myClients.reduce((sum, client) => {
    const metrics = mockMetrics[client.id]
    return sum + (metrics?.thisMonth.revenue || 0)
  }, 0)
  const totalViews = myClients.reduce((sum, client) => {
    const metrics = mockMetrics[client.id]
    return sum + (metrics?.currentWeek.views || 0)
  }, 0)
  const totalLeads = myClients.reduce((sum, client) => {
    const metrics = mockMetrics[client.id]
    return sum + (metrics?.currentWeek.leads || 0)
  }, 0)

  const handleAddClient = () => {
    setSelectedClient(null)
    setIsModalOpen(true)
  }

  const handleEditClient = (client: GoHighLevelClient) => {
    setSelectedClient(client)
    setIsModalOpen(true)
  }

  const handleSaveClient = (clientData: Partial<GoHighLevelClient>) => {
    if (selectedClient) {
      // Update existing
      setClients(clients.map(c => c.id === selectedClient.id ? { ...c, ...clientData } as GoHighLevelClient : c))
    } else {
      // Add new
      const newClient: GoHighLevelClient = {
        id: Date.now().toString(),
        name: clientData.name || "",
        email: clientData.email || "",
        phone: clientData.phone,
        company: clientData.company,
        subscriptionPlan: clientData.subscriptionPlan || "starter",
        affiliateUserId: user?.id,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        status: "active",
      }
      setClients([...clients, newClient])
    }
    setIsModalOpen(false)
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GoHighLevel Clients</h1>
          <p className="text-muted-foreground">
            Manage and track your GoHighLevel client subscriptions and metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            <Filter className="mr-2 h-4 w-4" />
            All Clients
          </Button>
          <Button
            variant={filter === "mine" ? "default" : "outline"}
            onClick={() => setFilter("mine")}
          >
            My Clients ({myClients.length})
          </Button>
          <Button onClick={handleAddClient}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Affiliate Stats */}
      {filter === "mine" && (
        <GHLStats
          totalClients={myClients.length}
          activeClients={myClients.filter(c => c.status === "active").length}
          totalRevenue={totalRevenue}
          monthlyRevenue={monthlyRevenue}
          weeklyViews={totalViews}
          weeklyLeads={totalLeads}
        />
      )}

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clients found</h3>
            <p className="text-muted-foreground mb-4">
              {filter === "mine" 
                ? "You haven't added any clients yet. Add your first client to get started!"
                : "No clients in the system yet."}
            </p>
            {filter === "mine" && (
              <Button onClick={handleAddClient}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <GHLClientCard
              key={client.id}
              client={client}
              metrics={mockMetrics[client.id]}
              onEdit={() => handleEditClient(client)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <GHLClientModal
          client={selectedClient}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveClient}
        />
      )}
    </div>
  )
}

