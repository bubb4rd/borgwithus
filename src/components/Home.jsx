import React from "react";
import main from '../assets/borgwithus.png';
export default function Home() {

    return (
        <section id="home">
            <div className="container">
                <div className="left-col">
                    <h1>Generate your borg.</h1>
                    <p>Take your drinking to another level with a BORG!</p>
                    <a href="#borg"><button>Let's BORG</button></a>
                </div>
                <div className="right-col">
                    <img src={main} alt="" />
                </div>
            </div>
        </section>
    );
}