import { useState } from "react";
import { Helmet } from "react-helmet";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isSameDay, parseISO, addHours } from "date-fns";
import { Activity, Lead } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGemini } from "@/hooks/useGemini";
import type { CalendarProps } from "@/components/ui/calendar";

// Activity form schema
const activityFormSchema = z.object({
  leadId: z.number().optional(),
  type: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startTime: z.date(),
  endTime: z.date(),
  completed: z.boolean().default(false),
  aiGenerated: z.boolean().default(false),
});

type ActivityFormValues = z.infer<typeof activityFormSchema>;

export default function Calendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const { toast } = useToast();
  
  // Current user ID (hardcoded for now)
  const userId = 1;

  // Fetch all activities for the current user
  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities", { userId }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/activities?userId=${userId}`);
      return response.json();
    },
  });

  // Fetch all leads (for the select dropdown)
  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Form setup
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: "meeting",
      title: "",
      description: "",
      startTime: new Date(),
      endTime: addHours(new Date(), 1),
      completed: false,
      aiGenerated: false,
    },
  });

  // Reset form when opening the modal
  const openActivityModal = (activity?: Activity) => {
    if (activity) {
      // Edit existing activity
      form.reset({
        leadId: activity.leadId || undefined,
        type: activity.type,
        title: activity.title,
        description: activity.description || "",
        startTime: activity.startTime ? new Date(activity.startTime) : new Date(),
        endTime: activity.endTime ? new Date(activity.endTime) : addHours(new Date(), 1),
        completed: activity.completed || false,
        aiGenerated: activity.aiGenerated || false,
      });
      setEditingActivity(activity);
    } else {
      // Create new activity
      form.reset({
        type: "meeting",
        title: "",
        description: "",
        startTime: selectedDate,
        endTime: addHours(selectedDate, 1),
        completed: false,
        aiGenerated: false,
      });
      setEditingActivity(null);
    }
    setIsCreatingActivity(true);
  };

  // Create or update activity mutation
  const { mutate: saveActivity, isPending } = useMutation({
    mutationFn: async (values: ActivityFormValues) => {
      const activityData = {
        ...values,
        userId, // Current user
        createdBy: userId,
      };
      
      if (editingActivity) {
        // Update existing activity
        return apiRequest("PATCH", `/api/activities/${editingActivity.id}`, activityData);
      } else {
        // Create new activity
        return apiRequest("POST", "/api/activities", activityData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: editingActivity ? "Activity updated" : "Activity created",
        description: `Your activity has been ${editingActivity ? "updated" : "scheduled"} successfully.`,
      });
      setIsCreatingActivity(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${editingActivity ? "update" : "create"} activity: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete activity mutation
  const { mutate: deleteActivity, isPending: isDeleting } = useMutation({
    mutationFn: async (activityId: number) => {
      return apiRequest("DELETE", `/api/activities/${activityId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "Activity deleted",
        description: "The activity has been removed from your calendar.",
      });
      setIsCreatingActivity(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete activity: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (values: ActivityFormValues) => {
    saveActivity(values);
  };

  // Get activities for the selected date
  const activitiesForSelectedDate = activities?.filter(activity => 
    activity.startTime && isSameDay(parseISO(activity.startTime.toString()), selectedDate)
  );

  // Get the color for an activity type
  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case "meeting":
        return "bg-primary-100 text-primary-600";
      case "call":
        return "bg-green-100 text-green-600";
      case "email":
        return "bg-purple-100 text-purple-600";
      case "task":
        return "bg-orange-100 text-orange-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  // Get the icon for an activity type
  const getActivityTypeIcon = (type: string) => {
    switch (type) {
      case "meeting":
        return "videocam";
      case "call":
        return "call";
      case "email":
        return "email";
      case "task":
        return "assignment";
      default:
        return "event";
    }
  };

  // Format time for display
  const formatTimeRange = (start?: Date | string | null, end?: Date | string | null) => {
    if (!start) return "";
    
    const startDate = typeof start === "string" ? new Date(start) : start;
    if (!startDate) return "";
    
    const formattedStart = format(startDate, "h:mm a");
    
    if (!end) return formattedStart;
    
    const endDate = typeof end === "string" ? new Date(end) : end;
    if (!endDate) return formattedStart;
    
    const formattedEnd = format(endDate, "h:mm a");
    
    return `${formattedStart} - ${formattedEnd}`;
  };

  return (
    <>
      <Helmet>
        <title>Calendar | GeminiCRM</title>
        <meta name="description" content="Schedule and manage meetings, calls, and other activities with your leads" />
      </Helmet>

      <div className="mb-6 flex justify-between items-baseline">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 md:hidden">Calendar</h1>
          <p className="text-sm text-gray-500">
            Schedule and manage your activities
          </p>
        </div>
        <Button 
          onClick={() => openActivityModal()}
          className="bg-primary-600 hover:bg-primary-700 text-white"
        >
          <span className="material-icons text-sm mr-1">add</span>
          New Activity
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarComponent 
              className="w-full" 
              mode="single" 
              selected={selectedDate} 
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={{
                hasActivity: (date) => {
                  return activities?.some(activity => 
                    activity.startTime && isSameDay(parseISO(activity.startTime.toString()), date)
                  ) || false;
                }
              }}
              modifiersClassNames={{
                hasActivity: "has-activity relative before:absolute before:bottom-1 before:left-1/2 before:transform before:-translate-x-1/2 before:w-1 before:h-1 before:bg-primary-500 before:rounded-full"
              }}
            />
          </CardContent>
        </Card>

        {/* Activities for selected date */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{format(selectedDate, "MMMM d, yyyy")}</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => openActivityModal()}
            >
              <span className="material-icons text-sm mr-1">add</span>
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded-md"></div>
                ))}
              </div>
            ) : activitiesForSelectedDate?.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <span className="material-icons text-4xl mb-2">event_busy</span>
                <p className="font-medium">No activities</p>
                <p className="text-sm">Nothing scheduled for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activitiesForSelectedDate?.map((activity) => (
                  <div 
                    key={activity.id}
                    className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                    onClick={() => openActivityModal(activity)}
                  >
                    <div className="flex items-center mb-2">
                      <div className={`rounded-full p-2 mr-2 ${getActivityTypeColor(activity.type)}`}>
                        <span className="material-icons text-sm">{getActivityTypeIcon(activity.type)}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{activity.title}</h4>
                        <p className="text-xs text-gray-500">
                          {formatTimeRange(activity.startTime, activity.endTime)}
                        </p>
                      </div>
                      {activity.completed && (
                        <span className="ml-auto material-icons text-green-500 text-sm">check_circle</span>
                      )}
                    </div>
                    {activity.description && (
                      <p className="text-xs text-gray-600 ml-10">{activity.description}</p>
                    )}
                    {activity.leadId && leads && (
                      <div className="mt-2 ml-10 flex items-center text-xs text-gray-500">
                        <span className="material-icons text-xs mr-1">person</span>
                        {leads.find(lead => lead.id === activity.leadId)?.fullName || `Lead #${activity.leadId}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Form Dialog */}
      <Dialog open={isCreatingActivity} onOpenChange={(open) => !open && setIsCreatingActivity(false)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingActivity ? "Edit Activity" : "Create New Activity"}</DialogTitle>
            <DialogDescription>
              {editingActivity 
                ? "Update the details of your activity." 
                : "Add a new activity to your calendar."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Activity title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="leadId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associated Lead</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a lead (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {leads?.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id.toString()}>
                            {lead.fullName} {lead.company ? `(${lead.company})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add details about this activity..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="completed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Mark as completed</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              
              {editingActivity && (
                <div className="flex justify-between items-center pt-4">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => deleteActivity(editingActivity.id)}
                    disabled={isDeleting || isPending}
                  >
                    {isDeleting ? (
                      <span className="material-icons animate-spin mr-2">refresh</span>
                    ) : (
                      <span className="material-icons mr-2">delete</span>
                    )}
                    Delete
                  </Button>
                </div>
              )}
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreatingActivity(false)}
                  disabled={isPending || isDeleting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isPending || isDeleting}
                >
                  {isPending ? (
                    <>
                      <span className="material-icons animate-spin mr-2">refresh</span>
                      Saving...
                    </>
                  ) : (
                    editingActivity ? "Update Activity" : "Create Activity"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
