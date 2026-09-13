import { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import {
  Search,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: 'general' | 'hardware' | 'flashing' | 'community';
}

const FAQS: FAQItem[] = [
  {
    category: 'general',
    question: 'What is K10 Hub?',
    answer: 'K10 Hub is an interactive learning platform and firmware hub specifically built for the UNIHIKER K10 microcomputer. It brings together tutorials, community project repositories, and a browser-based firmware flasher that lets you test and run code in seconds.',
  },
  {
    category: 'hardware',
    question: 'What microcontrollers and sensors are built into the UNIHIKER K10?',
    answer: 'The UNIHIKER K10 is powered by the ESP32-S3 dual-core LX7 processor (240MHz, 16MB Flash, 8MB PSRAM). It includes an integrated 2.8" color TFT display (240×320), GC2145 2MP camera, dual MEMS microphones, a speaker amplifier, 3× WS2812 RGB LEDs, an accelerometer, temperature/humidity sensor, ambient light sensor, and Micro:bit edge connector.',
  },
  {
    category: 'flashing',
    question: 'How does browser-based firmware flashing work?',
    answer: 'K10 Hub uses the standardized Web Serial API (available in modern browsers like Google Chrome, Microsoft Edge, Opera, and Brave). You connect your K10 using a USB-C data cable, click "Flash Firmware", select the serial COM port from the prompt, and the browser flashes the binary image directly to the ESP32-S3 without needing an IDE or driver installation.',
  },
  {
    category: 'flashing',
    question: 'Why is my K10 board not detected when connecting to flash?',
    answer: 'First, make sure you are using a certified USB data cable (some charging cables only carry power, not data). Second, verify that you are on Chrome or Edge on desktop (Web Serial is not supported in Safari or mobile browsers). If still unrecognized, hold down the BOOT button, plug in the cable, and release to enter ROM bootloader mode.',
  },
  {
    category: 'hardware',
    question: 'Can I program the K10 with Arduino IDE or MicroPython?',
    answer: 'Yes! The UNIHIKER K10 supports Arduino IDE, MicroPython, and ESP-IDF. K10 Hub offers pre-compiled firmware binaries for instant testing, as well as source code tutorials so you can modify and compile projects yourself.',
  },
  {
    category: 'community',
    question: 'How do I publish my own projects or tutorials on K10 Hub?',
    answer: 'Sign up for a free K10 Hub account. Once logged in, click "New Project" in the navigation bar to launch the project editor. You can write your guide in rich Markdown, specify required sensors, upload code or firmware binaries, and publish for the entire maker community to explore.',
  },
  {
    category: 'community',
    question: 'What are the user roles (User, Author, Admin) and how do I become an Author?',
    answer: 'Every new member begins as a User, which allows bookmarking, rating, and trying builds. You can apply to become a verified Author directly from your Profile page by submitting a sample build. Once approved by our team, you gain official Author status with the author badge and full publishing capabilities.',
  },
  {
    category: 'general',
    question: 'Where can I find official DFRobot documentation and discussions?',
    answer: 'You can check the official UNIHIKER wiki and join the DFRobot Maker Community forum to share maker stories, ask questions, and collaborate with hardware enthusiasts globally.',
  },
];

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState<'all' | 'general' | 'hardware' | 'flashing' | 'community'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = FAQS.filter((faq) => {
    const matchesCat = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>
      <Header />

      <main style={{ flex: 1, paddingTop: 'calc(var(--nav-height) + var(--space-8))', paddingBottom: 'var(--space-16)' }}>
        <div className="container" style={{ maxWidth: 900 }}>

          {/* Header */}
          <div style={{ marginBottom: 'var(--space-10)', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-2)' }}>
              <span style={{ width: 20, height: 2, backgroundColor: 'var(--color-accent)' }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--color-accent)',
                textTransform: 'uppercase',
              }}>
                Help &amp; Knowledge Base
              </span>
              <span style={{ width: 20, height: 2, backgroundColor: 'var(--color-accent)' }} />
            </div>

            <h1 style={{
              fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
              fontWeight: 800,
              color: 'var(--color-ink-primary)',
              letterSpacing: '-0.03em',
              marginBottom: 'var(--space-3)',
            }}>
              Frequently Asked Questions
            </h1>

            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--color-ink-secondary)',
              maxWidth: '58ch',
              margin: '0 auto var(--space-6)',
              lineHeight: 1.6,
            }}>
              Find quick answers about UNIHIKER K10 hardware, browser-based Web Serial flashing, authoring tutorials, and troubleshooting.
            </p>

            {/* Search input */}
            <div style={{
              position: 'relative',
              maxWidth: 480,
              margin: '0 auto',
            }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-ink-tertiary)',
                }}
              />
              <input
                type="text"
                placeholder="Search questions or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: 46,
                  padding: '0 16px 0 42px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink-primary)',
                  outline: 'none',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'border-color 0.15s ease',
                }}
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-8)',
          }}>
            {[
              { key: 'all', label: 'All Questions' },
              { key: 'general', label: 'General & Platform' },
              { key: 'hardware', label: 'Hardware & K10' },
              { key: 'flashing', label: 'Web Serial Flashing' },
              { key: 'community', label: 'Publishing & Community' },
            ].map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key as any)}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: '20px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  border: activeCategory === cat.key ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  backgroundColor: activeCategory === cat.key ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: activeCategory === cat.key ? '#ffffff' : 'var(--color-ink-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* FAQ Accordion List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-12)' }}>
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      boxShadow: isOpen ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleAccordion(idx)}
                      style={{
                        width: '100%',
                        padding: 'var(--space-5) var(--space-6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-4)',
                        border: 'none',
                        background: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: isOpen ? 'var(--color-accent)' : 'var(--color-ink-primary)',
                      }}>
                        {faq.question}
                      </span>
                      <ChevronDown
                        size={18}
                        style={{
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          color: isOpen ? 'var(--color-accent)' : 'var(--color-ink-tertiary)',
                          flexShrink: 0,
                        }}
                      />
                    </button>

                    {isOpen && (
                      <div style={{
                        padding: '0 var(--space-6) var(--space-5)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-ink-secondary)',
                        lineHeight: 1.7,
                        borderTop: '1px solid var(--color-border-subtle, rgba(0,0,0,0.04))',
                        paddingTop: 'var(--space-3)',
                      }}>
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-ink-tertiary)' }}>
                No questions found matching "{searchQuery}".
              </div>
            )}
          </div>

          {/* Need more help banner */}
          <div style={{
            padding: 'var(--space-6) var(--space-8)',
            backgroundColor: 'var(--color-paper-warm)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
          }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-ink-primary)', margin: 0 }}>
                Still have questions or need technical support?
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)', margin: '4px 0 0' }}>
                Join the official DFRobot Maker Community to connect directly with engineers and makers.
              </p>
            </div>
            <a
              href="https://community.dfrobot.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--secondary btn--sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              DFRobot Community
              <ExternalLink size={14} />
            </a>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
