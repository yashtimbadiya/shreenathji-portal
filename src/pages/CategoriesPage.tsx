import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { Card, PageHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { formatDate } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';

export function CategoriesPage() {
  const categories = useAppStore((s) => s.categories);
  const updateCategory = useAppStore((s) => s.updateCategory);

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Manage product categories"
        action={<Link to="/categories/new"><Button><Plus size={16} /> Add Category</Button></Link>}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Category', 'Products', 'Status', 'Created Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-border hover:bg-surface/50">
                  <td className="px-4 py-3 font-medium">{cat.name}</td>
                  <td className="px-4 py-3">{cat.productCount}</td>
                  <td className="px-4 py-3"><ActiveBadge active={cat.status === 'Active'} /></td>
                  <td className="px-4 py-3">{formatDate(cat.createdDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link to={`/products?category=${cat.id}`} className="text-xs text-brand hover:underline">View Products</Link>
                      {cat.status === 'Active' && (
                        <button
                          onClick={() => updateCategory(cat.id, { status: 'Disabled' })}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Disable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AddCategoryPage() {
  const navigate = useNavigate();
  const addCategory = useAppStore((s) => s.addCategory);
  const [name, setName] = useState('');

  // Support ?returnTo=/some/path so we can go back after adding
  const returnTo = new URLSearchParams(window.location.search).get('returnTo') ?? '/categories';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addCategory(name.trim());
    navigate(returnTo);
  };

  return (
    <div>
      <PageHeader title="Add Category" subtitle="Create a new product category" />
      <Card className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Category Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Elastic" required autoFocus />
          <div className="flex gap-3">
            <Button type="submit">Save Category</Button>
            <Button type="button" variant="outline" onClick={() => navigate(returnTo)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
