import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Hero from '../components/home/Hero';
import FeaturedProjects from '../components/home/FeaturedProjects';

export default function HomePage() {
  return (
    <>
      <Header />

      <main id="main-content" tabIndex={-1}>
        <Hero />
        <FeaturedProjects />
      </main>

      <Footer />
    </>
  );
}
