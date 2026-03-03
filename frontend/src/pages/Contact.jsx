import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { contactAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { MessageSquare, Mail, Phone, MapPin, CheckCircle2, Send, ArrowLeft, Home } from 'lucide-react';
import { toast } from 'sonner';

const SUBJECTS = [
  'General Inquiry',
  'Property Complaint',
  'Agent Complaint',
  'Payment Issue',
  'Account Problem',
  'Report a Bug',
  'Other',
];

export function Contact() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: user?.full_name || '',
    email: user?.email || '',
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) {
      toast.error('Please fill in all fields');
      return;
    }
    if (form.message.trim().length < 10) {
      toast.error('Message is too short. Please provide more detail.');
      return;
    }

    setLoading(true);
    try {
      await contactAPI.submit(form);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──
  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Message Sent!</h1>
        <p className="text-foreground/60 mb-2">
          Thank you, <span className="font-medium text-foreground">{form.name}</span>. Your message has been received.
        </p>
        <p className="text-foreground/60 mb-8">
          We'll review your message and get back to you at <span className="font-medium text-foreground">{form.email}</span> as soon as possible.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => { setSubmitted(false); setForm({ name: user?.full_name || '', email: user?.email || '', subject: '', message: '' }); }}>
            Send Another Message
          </Button>
          <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
            <Home className="w-4 h-4" /> Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Contact Us</h1>
        <p className="text-foreground/60 mt-2 max-w-md mx-auto">
          Have a complaint, question, or feedback? Send us a message and we'll get back to you.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Info Cards */}
        <div className="space-y-4">
          <Card className="p-5 border-border/60">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Email Us</p>
                <p className="text-xs text-foreground/55 mt-1">We reply within 24 hours</p>
                <p className="text-sm text-primary mt-1 font-medium">support@rentora.com.ng</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/60">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Call Us</p>
                <p className="text-xs text-foreground/55 mt-1">Mon – Fri, 9am – 5pm</p>
                <p className="text-sm text-primary mt-1 font-medium">+234 913 113 3832</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/60">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Our Location</p>
                <p className="text-xs text-foreground/55 mt-1">Ogbomoso Campus</p>
                <p className="text-sm text-foreground/70 mt-1">Ogbomoso, Oyo State, Nigeria</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/60 bg-primary/5">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Common Issues</p>
            <ul className="space-y-1.5 text-sm text-foreground/60">
              <li>• Payment not reflecting</li>
              <li>• Agent not responding</li>
              <li>• Wrong property details</li>
              <li>• Account access issues</li>
              <li>• Refund requests</li>
            </ul>
          </Card>
        </div>

        {/* Form */}
        <Card className="lg:col-span-2 p-6 border-border/60">
          <h2 className="font-semibold text-lg mb-5">Send a Message</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject *</Label>
              <Select value={form.subject} onValueChange={(v) => set('subject', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="What is this about?" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={form.message}
                onChange={(e) => set('message', e.target.value)}
                placeholder="Describe your issue or question in detail..."
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-foreground/40 text-right">{form.message.length} chars</p>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 gap-2">
              {loading ? 'Sending...' : <><Send className="w-4 h-4" /> Send Message</>}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default Contact;
