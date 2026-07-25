import { Link } from 'react-router-dom';
import { ArrowLeft, Target, Users, Shield, Zap, Heart, Award } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export function About() {
  const values = [
    {
      icon: Shield,
      title: 'Safety First',
      description: 'Every property is verified to ensure student safety and quality standards.',
    },
    {
      icon: Users,
      title: 'Student-Centered',
      description: 'Built by students, for students. We understand your unique needs.',
    },
    {
      icon: Zap,
      title: 'Fast & Simple',
      description: 'Book verified accommodation in minutes with our streamlined process.',
    },
    {
      icon: Heart,
      title: 'Community Driven',
      description: 'Connecting LAUTECH students with trusted local property agents.',
    },
  ];

  const team = [
    { name: 'Adebayo Oluwaseun', role: 'Co-Founder & CEO', initial: 'AO' },
    { name: 'Fatima Ibrahim', role: 'Co-Founder & CTO', initial: 'FI' },
    { name: 'Chukwuemeka Obi', role: 'Head of Operations', initial: 'CO' },
    { name: 'Blessing Adeola', role: 'Customer Success Lead', initial: 'BA' },
  ];

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
        <Link to="/"><ArrowLeft className="w-4 h-4" /> Back</Link>
      </Button>

      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <Award className="w-3.5 h-3.5" />
          LAUTECH's Trusted Housing Platform
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">About Rentora</h1>
        <p className="text-lg text-foreground/60 max-w-2xl mx-auto leading-relaxed">
          We're on a mission to make finding safe, affordable, and verified student accommodation 
          as easy as booking a ride. No more stress, no more scams — just quality homes you can trust.
        </p>
      </div>

      {/* Story Section */}
      <section className="mb-16">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold">Our Story</h2>
            </div>
            <p className="text-foreground/70 leading-relaxed mb-4">
              Rentora was founded in 2024 by LAUTECH students who experienced firsthand the challenges of finding 
              safe and affordable accommodation in Ogbomoso. Frustrated by unreliable agents, fake listings, and 
              lack of transparency, we decided to create a solution.
            </p>
            <p className="text-foreground/70 leading-relaxed mb-4">
              What started as a simple idea — a verified platform connecting students with trusted agents — 
              has grown into a community-driven marketplace serving hundreds of LAUTECH students.
            </p>
            <p className="text-foreground/70 leading-relaxed">
              Today, Rentora is the most trusted student housing platform in Ogbomoso, helping students 
              find their home away from home with confidence and ease.
            </p>
          </div>
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-8 border border-primary/20">
            <div className="space-y-6">
              <div>
                <p className="text-4xl font-bold text-primary">500+</p>
                <p className="text-sm text-foreground/60 mt-1">Students Helped</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-primary">150+</p>
                <p className="text-sm text-foreground/60 mt-1">Verified Properties</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-primary">50+</p>
                <p className="text-sm text-foreground/60 mt-1">Trusted Agents</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-primary">98%</p>
                <p className="text-sm text-foreground/60 mt-1">Satisfaction Rate</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Our Core Values</h2>
          <p className="text-foreground/60">The principles that guide everything we do</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {values.map((value, idx) => (
            <Card key={idx} className="p-6 text-center border-border/60 hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <value.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{value.title}</h3>
              <p className="text-sm text-foreground/60 leading-relaxed">{value.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Team Section */}
      <section className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Meet the Team</h2>
          <p className="text-foreground/60">The people behind Rentora</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {team.map((member, idx) => (
            <Card key={idx} className="p-6 text-center border-border/60">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                {member.initial}
              </div>
              <h3 className="font-semibold">{member.name}</h3>
              <p className="text-sm text-foreground/60 mt-1">{member.role}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Mission Section */}
      <section className="mb-16">
        <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-3">Our Mission</h2>
            <p className="text-foreground/70 text-lg leading-relaxed">
              To empower every LAUTECH student with access to safe, affordable, and verified accommodation, 
              creating a seamless housing experience that lets them focus on what truly matters — their education.
            </p>
          </div>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="text-center">
        <h2 className="text-2xl font-bold mb-3">Join the Rentora Community</h2>
        <p className="text-foreground/60 mb-6 max-w-xl mx-auto">
          Whether you're a student looking for your next home or an agent wanting to list verified properties, 
          we're here to help you every step of the way.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link to="/browse">Browse Properties</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/become-agent">Become an Agent</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

export default About;
