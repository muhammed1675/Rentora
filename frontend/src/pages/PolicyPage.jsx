import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { sections, policyRoutes } from '../lib/policyContent';

export function PolicyPage({ sectionId }) {
  const navigate = useNavigate();
  const current = sections.find(s => s.id === sectionId) || sections[0];
  const others = sections.filter(s => s.id !== sectionId);
  const Icon = current.icon;

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-5 gap-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <div className="text-center mb-8">
        <div className={`w-14 h-14 rounded-2xl ${current.bg} flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`w-7 h-7 ${current.color}`} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{current.label}</h1>
        <p className="text-muted-foreground mt-2 text-sm">Last updated: July 2026</p>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="space-y-6">
          {current.content.map((section, i) => (
            <div key={i}>
              <h3 className="font-semibold text-base mb-2">{section.title}</h3>
              <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line">{section.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Read our other policies
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {others.map(s => {
            const OIcon = s.icon;
            return (
              <Link
                key={s.id}
                to={policyRoutes[s.id]}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <OIcon className="w-3.5 h-3.5" />
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Questions? <a href="/contact" className="text-primary hover:underline">Contact us</a>
      </p>
    </div>
  );
}

export default PolicyPage;