"use client";

import { Shield, Zap, Eye, Award, Users, TrendingUp, Globe, HeartHandshake } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

export default function AboutPage() {
  const { dictionary } = useLocale();
  const { ref: storyRef, isVisible: storyVisible } = useScrollReveal();
  const { ref: statsRef, isVisible: statsVisible } = useScrollReveal();
  const { ref: valuesRef, isVisible: valuesVisible } = useScrollReveal();

  const values = [
    { icon: Eye, title: dictionary.about.values.transparency, color: "bg-blue-500/10 text-blue-600" },
    { icon: Shield, title: dictionary.about.values.reliability, color: "bg-green-500/10 text-green-600" },
    { icon: Zap, title: dictionary.about.values.speed, color: "bg-yellow-500/10 text-yellow-600" },
    { icon: Award, title: dictionary.about.values.quality, color: "bg-purple-500/10 text-purple-600" },
  ];

  const stats = [
    { icon: Users, value: "500+", label: "Clients Served" },
    { icon: TrendingUp, value: "3+", label: "Years Experience" },
    { icon: Globe, value: "10+", label: "Cities Covered" },
    { icon: HeartHandshake, value: "98%", label: "Satisfaction Rate" },
  ];

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.about.title}
          subtitle={dictionary.about.subtitle}
        />

        <div ref={storyRef} className={`max-w-3xl mx-auto mb-16 ${storyVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          <div className="bg-white rounded-2xl border border-border p-8 md:p-12">
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">{dictionary.about.story}</p>
            <p className="text-lg text-muted-foreground leading-relaxed">{dictionary.about.mission}</p>
          </div>
        </div>

        <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`bg-gradient-to-br from-navy to-navy-light rounded-2xl p-6 text-center text-white ${
                statsVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <stat.icon className="w-8 h-8 text-lime mx-auto mb-3" />
              <p className="text-3xl font-bold text-lime">{stat.value}</p>
              <p className="text-sm text-white/50 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <SectionHeading title={dictionary.about.values.title} />
        <div ref={valuesRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((value, index) => (
            <div
              key={index}
              className={`bg-white rounded-2xl border border-border p-8 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
                valuesVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={cn(value.color, "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4")}>
                <value.icon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold">{value.title}</h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
