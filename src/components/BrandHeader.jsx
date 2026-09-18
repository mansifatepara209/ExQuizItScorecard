import React from 'react';

function BrandHeader({ subtitle = "Live Scoreboard", showLogos = true }) {
    return (
        <header className="w-full bg-white border-b-2 border-quiz-border">
            {showLogos && (
                <div className="flex items-center justify-between px-6 md:px-10 py-3 bg-white">
                    <img
                        src="/brand/FROLIC.svg"
                        alt="Frolic 2026"
                        className="h-10 md:h-14 object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <img
                        src="/brand/DARSHAN.png"
                        alt="Darshan University"
                        className="h-10 md:h-14 object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                </div>
            )}

            <div className="relative bg-gradient-to-r from-[#C2185B] via-[#E91E63] to-[#7B1FA2] py-4 md:py-6 overflow-hidden">
                <div className="absolute -top-2 right-4 flex gap-2 opacity-40">
                    <div className="hexagon w-8 h-8 bg-orange-400"></div>
                    <div className="hexagon w-10 h-10 bg-purple-600"></div>
                    <div className="hexagon w-8 h-8 bg-pink-400"></div>
                </div>

                <div className="flex flex-col items-center justify-center text-center">
                    <img
                        src="/brand/EX-QUIZ-IT.svg"
                        alt="Ex-Quiz-It"
                        className="h-16 md:h-24 object-contain mb-2 drop-shadow-lg"
                        onError={(e) => { e.target.src = '/brand/EX-QUIZ-IT.png'; }}
                    />
                    {subtitle && (
                        <p className="text-white/90 text-xs md:text-sm font-bold uppercase tracking-[0.3em]">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
        </header>
    );
}

export default BrandHeader;