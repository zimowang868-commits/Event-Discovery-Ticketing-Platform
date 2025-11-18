import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
    const { pathname } = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    const closeMenu = () => setMenuOpen(false);

    return (
        <div className="container-up">
            <header className="site-header">
                <h1 className="site-title">Events Around</h1>

                <div className="header-actions desktop-only">
                    <Link
                        to="/"
                        className="header-btn"
                        aria-current={pathname === "/" ? "page" : undefined}
                    >
                        <i className="fas fa-search"></i>
                        Search
                    </Link>
                    <Link
                        to="/favorites"
                        className="header-btn"
                        aria-current={pathname === "/favorites" ? "page" : undefined}
                    >
                        <i className="far fa-heart"></i>
                        Favorites
                    </Link>
                </div>

                <button
                    type="button"
                    className="header-menu-btn mobile-only"
                    aria-label="Open navigation menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((o) => !o)}
                >
                    <i className="fas fa-bars"></i>
                </button>
            </header>

            {menuOpen && (
                <nav className="header-mobile-menu mobile-only" role="menu">
                    <Link
                        to="/"
                        className="header-mobile-item"
                        onClick={closeMenu}
                        aria-current={pathname === "/" ? "page" : undefined}
                    >
                        <i className="fas fa-search"></i>
                        <span>Search</span>
                    </Link>
                    <Link
                        to="/favorites"
                        className="header-mobile-item"
                        onClick={closeMenu}
                        aria-current={pathname === "/favorites" ? "page" : undefined}
                    >
                        <i className="far fa-heart"></i>
                        <span>Favorites</span>
                    </Link>
                </nav>
            )}

            <hr className="section-divider" />
        </div>
    );
}