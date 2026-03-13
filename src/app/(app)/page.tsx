import { ArrowRight, Layout, Type, Palette, Link, ClipboardCheck, Gauge, FileCheck, Search, Image } from 'lucide-react';
import ReviewHistory from '@/components/ReviewHistory';

export default function Home() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold text-[#262626]">
          Website QA Dashboard
        </h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          Run scoped website reviews — choose specific test categories, specific pages,
          or a full site review. Get detailed reports with screenshots.
        </p>
      </div>

      {/* Quick start */}
      <a
        href="/review"
        className="group flex items-center justify-between p-6 bg-[#262626] rounded-2xl text-white hover:bg-[#333] transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#FF7F11] rounded-xl flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Start New Review</h2>
            <p className="text-sm text-gray-400">Configure and run a website quality review</p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#FF7F11] group-hover:translate-x-1 transition-all" />
      </a>

      {/* Review history */}
      <ReviewHistory />

      {/* Test categories overview */}
      <div>
        <h2 className="text-lg font-semibold text-[#262626] mb-4">Test Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: Layout,
              title: 'General Layout',
              description: 'Viewport responsiveness, element overlap, spacing consistency, z-index issues',
              color: 'bg-blue-50 text-blue-600',
            },
            {
              icon: Type,
              title: 'Typography & Content',
              description: 'Font sizes, heading hierarchy, line heights, text contrast (WCAG AA)',
              color: 'bg-purple-50 text-purple-600',
            },
            {
              icon: Palette,
              title: 'Color Scheme',
              description: 'Compare page colors against reference images using Delta-E color difference',
              color: 'bg-[#FF7F11]/10 text-[#FF7F11]',
            },
            {
              icon: Link,
              title: 'Broken Links & Images',
              description: 'Check all links return 200, images load correctly, missing alt attributes',
              color: 'bg-[#ACBFA4]/20 text-[#5a7a4e]',
            },
            {
              icon: Gauge,
              title: 'PageSpeed Insights',
              description: 'Google Lighthouse performance, accessibility, best practices & SEO scores',
              color: 'bg-emerald-50 text-emerald-600',
            },
            {
              icon: FileCheck,
              title: 'Content Cross-Check',
              description: 'Upload a PDF, DOCX, ODT, or text document and verify its content appears on website pages',
              color: 'bg-teal-50 text-teal-600',
            },
            {
              icon: Search,
              title: 'Text Finder',
              description: 'Search for specific words, sentences, or paragraphs across all pages',
              color: 'bg-indigo-50 text-indigo-600',
            },
            {
              icon: Image,
              title: 'Images & Media',
              description: 'Image quality, stretching, alt text quality, video loading, slider/carousel functionality',
              color: 'bg-rose-50 text-rose-600',
            },
          ].map((cat) => (
            <div
              key={cat.title}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cat.color}`}>
                  <cat.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#262626]">{cat.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{cat.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div>
        <h2 className="text-lg font-semibold text-[#262626] mb-4">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: 'Enter Your URL',
              description: 'Provide a website URL or upload a sitemap. We\'ll discover all pages automatically.',
            },
            {
              step: '2',
              title: 'Choose Scope',
              description: 'Run a full review, select specific categories, or pick individual pages to test.',
            },
            {
              step: '3',
              title: 'Get Results',
              description: 'View issues in real-time, then download a comprehensive PDF report with screenshots.',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-10 h-10 bg-[#FF7F11] text-white rounded-full flex items-center justify-center mx-auto text-sm font-bold">
                {item.step}
              </div>
              <h3 className="text-sm font-semibold text-[#262626] mt-3">{item.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
