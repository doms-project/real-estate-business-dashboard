"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, CheckCircle2, Circle, Target, TrendingUp, Calendar, Flame, Edit, Trash2, PlusCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Task {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  due_date?: string
  category: string
  created_at: string
}

interface Habit {
  id: string
  name: string
  description?: string
  frequency: 'daily' | 'weekly' | 'monthly'
  target_count: number
  color: string
  is_active: boolean
  created_at: string
  current_streak?: number
  longest_streak?: number
  total_completions?: number
  completion_rate?: number
}

interface HealthGoal {
  id: string
  title: string
  description?: string
  category: string
  target_value?: number
  target_unit?: string
  current_value: number
  deadline?: string
  completed: boolean
  progress_percentage: number
  days_remaining?: number
}

export default function HealthPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [goals, setGoals] = useState<HealthGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [habitDialogOpen, setHabitDialogOpen] = useState(false)
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    category: 'general'
  })
  const [newHabit, setNewHabit] = useState({
    name: '',
    description: '',
    frequency: 'daily' as const,
    target_count: 1,
    color: '#3b82f6'
  })
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'fitness',
    target_value: 0,
    target_unit: ''
  })
  const { toast } = useToast()

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [tasksRes, habitsRes, goalsRes] = await Promise.all([
        fetch('/api/personal-health/tasks'),
        fetch('/api/personal-health/habits?includeStats=true'),
        fetch('/api/personal-health/goals')
      ])

      const [tasksData, habitsData, goalsData] = await Promise.all([
        tasksRes.json(),
        habitsRes.json(),
        goalsRes.json()
      ])

      if (tasksData.success) setTasks(tasksData.data)
      if (habitsData.success) setHabits(habitsData.data)
      if (goalsData.success) setGoals(goalsData.data)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Failed to load health data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleTask = async (taskId: string, currentCompleted: boolean) => {
    try {
      const response = await fetch(`/api/personal-health/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted })
      })

      const data = await response.json()
      if (data.success) {
        setTasks(tasks.map(task =>
          task.id === taskId ? { ...task, completed: !currentCompleted } : task
        ))
        toast({
          title: "Success",
          description: `Task ${!currentCompleted ? 'completed' : 'marked incomplete'}`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive"
      })
    }
  }

  const logHabit = async (habitId: string) => {
    try {
      const response = await fetch(`/api/personal-health/habits/${habitId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1 })
      })

      const data = await response.json()
      if (data.success) {
        // Refresh habits data to get updated stats
        const habitsRes = await fetch('/api/personal-health/habits?includeStats=true')
        const habitsData = await habitsRes.json()
        if (habitsData.success) setHabits(habitsData.data)

        toast({
          title: "Success",
          description: "Habit logged successfully!",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log habit",
        variant: "destructive"
      })
    }
  }

  const createTask = async () => {
    if (!newTask.title.trim()) return

    try {
      const response = await fetch('/api/personal-health/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      })

      const data = await response.json()
      if (data.success) {
        setTasks([data.data, ...tasks])
        setNewTask({ title: '', description: '', priority: 'medium', category: 'general' })
        setTaskDialogOpen(false)
        toast({
          title: "Success",
          description: "Task created successfully!",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive"
      })
    }
  }

  const createHabit = async () => {
    if (!newHabit.name.trim()) return

    try {
      const response = await fetch('/api/personal-health/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHabit)
      })

      const data = await response.json()
      if (data.success) {
        setHabits([data.data, ...habits])
        setNewHabit({ name: '', description: '', frequency: 'daily', target_count: 1, color: '#3b82f6' })
        setHabitDialogOpen(false)
        toast({
          title: "Success",
          description: "Habit created successfully!",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create habit",
        variant: "destructive"
      })
    }
  }

  const createGoal = async () => {
    if (!newGoal.title.trim()) return

    try {
      const response = await fetch('/api/personal-health/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGoal)
      })

      const data = await response.json()
      if (data.success) {
        setGoals([data.data, ...goals])
        setNewGoal({ title: '', description: '', category: 'fitness', target_value: 0, target_unit: '' })
        setGoalDialogOpen(false)
        toast({
          title: "Success",
          description: "Goal created successfully!",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create goal",
        variant: "destructive"
      })
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      fitness: 'bg-blue-100 text-blue-800',
      nutrition: 'bg-green-100 text-green-800',
      mental: 'bg-purple-100 text-purple-800',
      sleep: 'bg-indigo-100 text-indigo-800',
      general: 'bg-gray-100 text-gray-800'
    }
    return colors[category] || colors.general
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading your health dashboard...</div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personal Health</h1>
          <p className="text-muted-foreground">
            Track your habits, tasks, and wellness goals
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="habits">Habits</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Completed Tasks</p>
                    <p className="text-2xl font-bold">{tasks.filter(t => t.completed).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Active Habits</p>
                    <p className="text-2xl font-bold">{habits.filter(h => h.is_active).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Active Goals</p>
                    <p className="text-2xl font-bold">{goals.filter(g => !g.completed).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">Avg Completion</p>
                    <p className="text-2xl font-bold">
                      {habits.length > 0
                        ? Math.round(habits.reduce((sum, h) => sum + (h.completion_rate || 0), 0) / habits.length)
                        : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Today&apos;s Tasks</CardTitle>
                  <CardDescription>Your daily to-do list</CardDescription>
                </div>
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>Add a new task to your list</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="task-title">Title</Label>
                        <Input
                          id="task-title"
                          value={newTask.title}
                          onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                          placeholder="Enter task title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="task-description">Description</Label>
                        <Textarea
                          id="task-description"
                          value={newTask.description}
                          onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                          placeholder="Enter task description (optional)"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="task-priority">Priority</Label>
                          <Select value={newTask.priority} onValueChange={(value: any) => setNewTask({...newTask, priority: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="task-category">Category</Label>
                          <Select value={newTask.category} onValueChange={(value) => setNewTask({...newTask, category: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="fitness">Fitness</SelectItem>
                              <SelectItem value="nutrition">Nutrition</SelectItem>
                              <SelectItem value="mental">Mental</SelectItem>
                              <SelectItem value="sleep">Sleep</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={createTask}>Create Task</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => toggleTask(task.id, task.completed)}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex-1">
                      <span className={task.completed ? "text-muted-foreground line-through" : ""}>
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={getCategoryColor(task.category)}>
                          {task.category}
                        </Badge>
                        <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {task.priority} priority
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No tasks yet. Create your first task to get started!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Habits */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Habits</CardTitle>
                  <CardDescription>Your daily habit tracking</CardDescription>
                </div>
                <Dialog open={habitDialogOpen} onOpenChange={setHabitDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Habit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Habit</DialogTitle>
                      <DialogDescription>Start tracking a new daily habit</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="habit-name">Habit Name</Label>
                        <Input
                          id="habit-name"
                          value={newHabit.name}
                          onChange={(e) => setNewHabit({...newHabit, name: e.target.value})}
                          placeholder="e.g., Exercise, Read, Meditate"
                        />
                      </div>
                      <div>
                        <Label htmlFor="habit-description">Description</Label>
                        <Textarea
                          id="habit-description"
                          value={newHabit.description}
                          onChange={(e) => setNewHabit({...newHabit, description: e.target.value})}
                          placeholder="Optional description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="habit-frequency">Frequency</Label>
                          <Select value={newHabit.frequency} onValueChange={(value: any) => setNewHabit({...newHabit, frequency: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="habit-target">Target Count</Label>
                          <Input
                            id="habit-target"
                            type="number"
                            min="1"
                            value={newHabit.target_count}
                            onChange={(e) => setNewHabit({...newHabit, target_count: parseInt(e.target.value) || 1})}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={createHabit}>Create Habit</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {habits.filter(h => h.is_active).slice(0, 3).map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: habit.color }}
                      />
                      <div>
                        <div className="font-medium">{habit.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-4">
                          <span>{habit.current_streak || 0} day streak</span>
                          <span>{habit.completion_rate || 0}% completion rate</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => logHabit(habit.id)}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Log
                    </Button>
                  </div>
                ))}
                {habits.filter(h => h.is_active).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No active habits. Create your first habit to start building healthy routines!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Tasks</CardTitle>
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>Add a new task to your list</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="task-title">Title</Label>
                        <Input
                          id="task-title"
                          value={newTask.title}
                          onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                          placeholder="Enter task title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="task-description">Description</Label>
                        <Textarea
                          id="task-description"
                          value={newTask.description}
                          onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                          placeholder="Enter task description (optional)"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="task-priority">Priority</Label>
                          <Select value={newTask.priority} onValueChange={(value: any) => setNewTask({...newTask, priority: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="task-category">Category</Label>
                          <Select value={newTask.category} onValueChange={(value) => setNewTask({...newTask, category: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="fitness">Fitness</SelectItem>
                              <SelectItem value="nutrition">Nutrition</SelectItem>
                              <SelectItem value="mental">Mental</SelectItem>
                              <SelectItem value="sleep">Sleep</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={createTask}>Create Task</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleTask(task.id, task.completed)}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <span className={task.completed ? "text-muted-foreground line-through" : ""}>
                        {task.title}
                      </span>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getCategoryColor(task.category)}>
                        {task.category}
                      </Badge>
                      <Badge variant="outline" className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation()
                          try {
                            const response = await fetch(`/api/personal-health/tasks/${task.id}`, {
                              method: 'DELETE'
                            })
                            const data = await response.json()
                            if (data.success) {
                              setTasks(tasks.filter(t => t.id !== task.id))
                              toast({
                                title: "Success",
                                description: "Task deleted successfully",
                              })
                            }
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: "Failed to delete task",
                              variant: "destructive"
                            })
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="habits" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Habits</CardTitle>
                <Dialog open={habitDialogOpen} onOpenChange={setHabitDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Habit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Habit</DialogTitle>
                      <DialogDescription>Start tracking a new daily habit</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="habit-name">Habit Name</Label>
                        <Input
                          id="habit-name"
                          value={newHabit.name}
                          onChange={(e) => setNewHabit({...newHabit, name: e.target.value})}
                          placeholder="e.g., Exercise, Read, Meditate"
                        />
                      </div>
                      <div>
                        <Label htmlFor="habit-description">Description</Label>
                        <Textarea
                          id="habit-description"
                          value={newHabit.description}
                          onChange={(e) => setNewHabit({...newHabit, description: e.target.value})}
                          placeholder="Optional description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="habit-frequency">Frequency</Label>
                          <Select value={newHabit.frequency} onValueChange={(value: any) => setNewHabit({...newHabit, frequency: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="habit-target">Target Count</Label>
                          <Input
                            id="habit-target"
                            type="number"
                            min="1"
                            value={newHabit.target_count}
                            onChange={(e) => setNewHabit({...newHabit, target_count: parseInt(e.target.value) || 1})}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={createHabit}>Create Habit</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {habits.map((habit) => (
                  <div key={habit.id} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: habit.color }}
                        />
                        <div>
                          <h3 className="font-medium">{habit.name}</h3>
                          <p className="text-sm text-muted-foreground">{habit.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => logHabit(habit.id)}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Log Today
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/personal-health/habits/${habit.id}`, {
                                method: 'DELETE'
                              })
                              const data = await response.json()
                              if (data.success) {
                                setHabits(habits.filter(h => h.id !== habit.id))
                                toast({
                                  title: "Success",
                                  description: "Habit deleted successfully",
                                })
                              }
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to delete habit",
                                variant: "destructive"
                              })
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="font-medium">{habit.current_streak || 0}</div>
                        <div className="text-muted-foreground">Current Streak</div>
                      </div>
                      <div>
                        <div className="font-medium">{habit.longest_streak || 0}</div>
                        <div className="text-muted-foreground">Longest Streak</div>
                      </div>
                      <div>
                        <div className="font-medium">{habit.completion_rate || 0}%</div>
                        <div className="text-muted-foreground">Completion Rate</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Health Goals</CardTitle>
                <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Goal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Goal</DialogTitle>
                      <DialogDescription>Set a new health goal</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="goal-title">Goal Title</Label>
                        <Input
                          id="goal-title"
                          value={newGoal.title}
                          onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                          placeholder="e.g., Lose 10 pounds, Run 5k"
                        />
                      </div>
                      <div>
                        <Label htmlFor="goal-description">Description</Label>
                        <Textarea
                          id="goal-description"
                          value={newGoal.description}
                          onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                          placeholder="Optional description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="goal-category">Category</Label>
                          <Select value={newGoal.category} onValueChange={(value) => setNewGoal({...newGoal, category: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fitness">Fitness</SelectItem>
                              <SelectItem value="nutrition">Nutrition</SelectItem>
                              <SelectItem value="mental">Mental Health</SelectItem>
                              <SelectItem value="sleep">Sleep</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="goal-target">Target Value</Label>
                          <Input
                            id="goal-target"
                            type="number"
                            value={newGoal.target_value}
                            onChange={(e) => setNewGoal({...newGoal, target_value: parseInt(e.target.value) || 0})}
                            placeholder="e.g., 10"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="goal-unit">Unit</Label>
                        <Input
                          id="goal-unit"
                          value={newGoal.target_unit}
                          onChange={(e) => setNewGoal({...newGoal, target_unit: e.target.value})}
                          placeholder="e.g., pounds, miles, hours"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={createGoal}>Create Goal</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {goals.map((goal) => (
                  <div key={goal.id} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-medium">{goal.title}</h3>
                        <p className="text-sm text-muted-foreground">{goal.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getCategoryColor(goal.category)}>
                          {goal.category}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/personal-health/goals/${goal.id}`, {
                                method: 'DELETE'
                              })
                              const data = await response.json()
                              if (data.success) {
                                setGoals(goals.filter(g => g.id !== goal.id))
                                toast({
                                  title: "Success",
                                  description: "Goal deleted successfully",
                                })
                              }
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to delete goal",
                                variant: "destructive"
                              })
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress</span>
                        <span>{goal.current_value} / {goal.target_value} {goal.target_unit}</span>
                      </div>
                      <Progress value={goal.progress_percentage} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{goal.progress_percentage}% complete</span>
                        {goal.days_remaining && (
                          <span>{goal.days_remaining} days remaining</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {goals.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No goals yet. Set your first health goal to start tracking progress!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


