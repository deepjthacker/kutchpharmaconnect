import { Search, Building2, Truck, ArrowRight, ShieldCheck } from 'lucide-react'

const categories = [
  'Pharmaceutical','Surgical','OTC','Ayurvedic',
  'Nutraceutical','Medical Devices','Diagnostic','Veterinary'
]

function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <a className="brand" href="/">
            <div className="brand-mark">KP</div>
            <div>
              <div className="brand-name">KutchPharmaConnect</div>
              <div className="brand-tagline">Find Who Handles What in Kutch</div>
            </div>
          </a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-inner">
            <div className="eyebrow"><ShieldCheck size={16}/> Kutch pharmaceutical directory</div>
            <h1>Find Who Handles<br/><span>What in Kutch.</span></h1>
            <p className="hero-copy">
              Search pharmaceutical companies, distributors, divisions and local contact details.
            </p>

            <div className="search-box">
              <Search size={22}/>
              <input
                type="search"
                placeholder="Search company, distributor, division..."
                aria-label="Search company, distributor, division"
              />
              <button>Search</button>
            </div>

            <div className="quick-links">
              <button><Building2 size={17}/> Browse Companies <ArrowRight size={15}/></button>
              <button><Truck size={17}/> Browse Distributors <ArrowRight size={15}/></button>
            </div>
          </div>
        </section>

        <section className="directory-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="section-kicker">DIRECTORY</p>
                <h2>Browse by category</h2>
              </div>
              <p>Start with the type of business you are looking for.</p>
            </div>

            <div className="category-grid">
              {categories.map(category => (
                <button className="category-card" key={category}>
                  <span>{category}</span>
                  <ArrowRight size={17}/>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-inner">
          <span>KutchPharmaConnect</span>
          <span>Companies • Distributors • Divisions • Contact Details</span>
        </div>
      </footer>
    </div>
  )
}

export default App
