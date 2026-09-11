import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const MILESTONES = [
  {
    step: '01',
    category: 'FUNDAMENTALS',
    title: 'First Blink & Hardware I/O',
    description:
      'Direct control of the ESP32-S3 dual-core processor, addressable RGB LEDs, tactile buttons, and GPIO expansion pins.',
    tag: 'GPIO / RGB / Buttons',
  },
  {
    step: '02',
    category: 'SENSORS & DISPLAY',
    title: 'LCD Graphics & Audio',
    description:
      'Real-time data visualization on the 2.8" color LCD (240×320), I2S microphone signal processing, and onboard speaker synthesis.',
    tag: 'SPI Display / I2S Audio',
  },
  {
    step: '03',
    category: 'CONNECTIVITY',
    title: 'IoT & Wireless Telemetry',
    description:
      'Low-latency ESP-NOW mesh messaging between boards, local web dashboard servers, and cloud telemetry via 2.4GHz Wi-Fi.',
    tag: 'Wi-Fi / ESP-NOW / MQTT',
  },
  {
    step: '04',
    category: 'EDGE INTELLIGENCE',
    title: 'Camera Vision & Robotics',
    description:
      'Parallel DVP camera stream processing with the 2MP GC2145 sensor, on-device machine vision inference, and robotics motor integration.',
    tag: 'DVP Camera / On-Device AI',
  },
];

export default function LearningProgression() {
  return (
    <section className="progression-section" id="learning-path" aria-labelledby="progression-headline">
      <div className="container">

        {/* Section Header */}
        <div className="progression-header">
          <div className="progression-eyebrow" aria-hidden="true">
            <span className="progression-eyebrow-line" />
            <span className="progression-eyebrow-tag">CURRICULUM &amp; ROADMAP</span>
          </div>

          <h2 className="progression-headline" id="progression-headline">
            From First Blink to <em>AI Vision.</em>
          </h2>

          <p className="progression-subline">
            A structured, hands-on learning roadmap for the UNIHIKER K10. Start with essential
            hardware primitives and progress all the way to on-device neural network vision.
          </p>
        </div>

        {/* 4 Milestones Grid */}
        <div className="progression-grid">
          {MILESTONES.map((item) => (
            <div key={item.step} className="progression-card">
              <div className="progression-card__header">
                <span className="progression-card__num">{item.step}</span>
                <span className="progression-card__category">{item.category}</span>
              </div>

              <h3 className="progression-card__title">{item.title}</h3>

              <p className="progression-card__desc">{item.description}</p>

              <div className="progression-card__footer">
                <span className="progression-card__tag">{item.tag}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA bar */}
        <div className="progression-footer">
          <span className="progression-footer__text">
            All projects include pre-compiled firmware for instant browser flashing.
          </span>
          <Link to="/projects" className="btn btn--secondary btn--sm">
            Browse All Projects <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

      </div>
    </section>
  );
}
