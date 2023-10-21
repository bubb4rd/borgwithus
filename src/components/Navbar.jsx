import React from "react";
import 'boxicons';
export default function NavBar() {

    return (
        <header>
            <div className="header-content">
            <div className="logo">
                <a href=""><box-icon name='beer'/></a>
                </div>
            <nav>
                <ul>
                    <li className="nav-item"><a href="#borg" className="nav-link">Borg</a></li>
                    <li className="nav-item"><a href="#about" className="nav-link">Recipe</a></li>
                </ul>
            </nav>
            </div>
        </header>
    );
}