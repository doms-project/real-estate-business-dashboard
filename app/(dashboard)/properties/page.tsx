import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, MapPin, Home, DollarSign } from "lucide-react"

export default function PropertiesPage() {
  const properties = [
    {
      id: "1",
      address: "123 Main St, San Francisco, CA",
      type: "Apartment",
      status: "Active",
      value: 850000,
      tasks: 3,
    },
    {
      id: "2",
      address: "456 Oak Ave, Los Angeles, CA",
      type: "House",
      status: "Rented",
      value: 1200000,
      tasks: 1,
    },
  ]

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Property Management</h1>
          <p className="text-muted-foreground">
            Manage your properties and listings
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {properties.map((property) => (
          <Card key={property.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    {property.type}
                  </CardTitle>
                  <CardDescription className="mt-2 flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {property.address}
                  </CardDescription>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  property.status === "Active"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }`}>
                  {property.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Value</span>
                  <span className="text-lg font-semibold flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {property.value.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tasks</span>
                  <span className="text-lg font-semibold">{property.tasks}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}


