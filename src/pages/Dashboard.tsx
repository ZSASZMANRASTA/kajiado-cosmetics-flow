import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Users, 
  LogOut,
  ShoppingBag,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

const Dashboard = () => {
  const { user, signOut, userRole } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    {
      title: 'Point of Sale',
      description: 'Process sales and transactions',
      icon: ShoppingCart,
      path: '/pos',
      color: 'bg-primary',
      roles: ['admin', 'cashier']
    },
    {
      title: 'Inventory',
      description: 'Manage products and stock',
      icon: Package,
      path: '/inventory',
      color: 'bg-secondary',
      roles: ['admin', 'cashier']
    },
    {
      title: 'Sales Reports',
      description: 'View sales analytics',
      icon: BarChart3,
      path: '/reports',
      color: 'bg-success',
      roles: ['admin']
    },
    {
      title: 'User Management',
      description: 'Manage staff accounts',
      icon: Users,
      path: '/users',
      color: 'bg-accent',
      roles: ['admin']
    },
  ];

  const filteredMenu = menuItems.filter(item => 
    item.roles.includes(userRole || '')
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Cosmetics POS</h1>
              <p className="text-xs text-muted-foreground">Kajiado Shop</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Welcome back! Select an option to get started.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMenu.map((item) => (
            <Card 
              key={item.path}
              className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              onClick={() => navigate(item.path)}
            >
              <CardHeader>
                <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-lg ${item.color} text-white`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full">
                  Open →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {userRole === 'admin' && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">KES 0</div>
                <p className="text-xs text-muted-foreground">No sales recorded today</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Items in inventory</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Items need restocking</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
