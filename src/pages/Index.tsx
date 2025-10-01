import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Loader2 } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ShoppingBag className="h-10 w-10" />
        </div>
         <h1 className="text-4xl font-bold">Cosmetics POS System</h1>
         <p className="text-xl text-muted-foreground">Kajiado Shop Management</p>
         <div className="flex items-center justify-center gap-3">
           <Button size="lg" onClick={() => navigate('/auth')}>
             Get Started →
           </Button>
           <Button variant="outline" size="lg" onClick={() => navigate('/dashboard')}>
             Go to Dashboard
           </Button>
         </div>
      </div>
    </div>
  );
};

export default Index;
