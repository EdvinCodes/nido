'use client';

/**
 * Renders every installed shadcn/ui component with representative content, so a reviewer
 * can eyeball the whole kit in one scroll instead of hunting through individual features.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { Bell, ChevronDown, Home, Search, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const demoFormSchema = z.object({
  name: z.string().min(1, 'Required'),
});

function DemoForm() {
  const form = useForm<z.infer<typeof demoFormSchema>>({
    resolver: zodResolver(demoFormSchema),
    defaultValues: { name: '' },
  });

  return (
    <Form {...form}>
      <form className="max-w-sm space-y-4" onSubmit={form.handleSubmit(() => undefined)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Space name</FormLabel>
              <FormControl>
                <Input placeholder="Casa de los García" {...field} />
              </FormControl>
              <FormDescription>Shown to every member of the space.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}

export function ComponentsDemo() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Buttons &amp; badges</CardTitle>
          <CardDescription>Every variant, for a quick visual diff.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button size="icon" aria-label="Home">
            <Home />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inputs &amp; form</CardTitle>
          <CardDescription>Labels, inputs, selects, and a validated form field.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="dev-tokens-input">Description</Label>
              <Input id="dev-tokens-input" placeholder="Weekly groceries" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dev-tokens-select">Category</Label>
              <Select defaultValue="groceries">
                <SelectTrigger id="dev-tokens-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="groceries">Groceries</SelectItem>
                  <SelectItem value="housing">Housing</SelectItem>
                  <SelectItem value="transport">Transport</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DemoForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overlays</CardTitle>
          <CardDescription>Dialog, sheet, popover, dropdown, and tooltip.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete transaction</DialogTitle>
                <DialogDescription>
                  This removes the 42,50 € grocery run from 3 August. It can be restored from the
                  activity log for 30 days.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Quick add</SheetTitle>
                <SheetDescription>Amount, category, done.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent className="text-sm">Popover content.</PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Menu <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Notifications">
                <Bell className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>3 unread notifications</TooltipContent>
          </Tooltip>

          <Button variant="outline" onClick={() => toast.success('Transacción guardada')}>
            Trigger toast
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabs, avatars &amp; scroll area</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <Tabs defaultValue="ledger">
            <TabsList>
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
              <TabsTrigger value="budgets">Budgets</TabsTrigger>
              <TabsTrigger value="goals">Goals</TabsTrigger>
            </TabsList>
            <TabsContent value="ledger" className="text-sm text-muted-foreground">
              Every income and expense, newest first.
            </TabsContent>
            <TabsContent value="budgets" className="text-sm text-muted-foreground">
              Limits per category, per member, or per space.
            </TabsContent>
            <TabsContent value="goals" className="text-sm text-muted-foreground">
              Savings pots with a target date.
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarImage src="/does-not-exist.png" alt="" />
              <AvatarFallback>AM</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>
                <Wallet className="size-4" />
              </AvatarFallback>
            </Avatar>
          </div>

          <ScrollArea className="h-24 w-full rounded-md border p-3">
            <p className="text-sm">
              Nido — Spanish for nest. The place where things are gathered and kept safe.
            </p>
            <p className="mt-2 text-sm">
              This paragraph is long enough to require scrolling inside the fixed-height area above,
              which is exactly what this component exists to demonstrate.
            </p>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skeletons</CardTitle>
          <CardDescription>Loading states match the real layout, never a spinner.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Search className="size-4" />
        <span>Every state above renders identically in light and dark theme.</span>
      </div>
    </div>
  );
}
