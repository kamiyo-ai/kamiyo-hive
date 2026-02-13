// components/GlitchBackground.js
"use client";
import { useEffect, useState } from "react";

const baseText = [
    "KAMIYO.AI", "かみよ.じんこうちのう",
    "INITIALIZING HIVE INSTANCE", "ハイブインスタンス起動中",
    "DEPLOYING AGENT CLUSTER", "エージェントクラスタ展開中",
    "SPINNING UP INFERENCE NODE", "推論ノードをスピンアップ中",
    "x402 HANDSHAKE INITIATED", "x402ハンドシェイク開始",
    "TRUST LAYER SYNC", "信頼レイヤー同期中",
    "AGENT HIVE SELF-HEALING", "ハイブ自己修復 [pfn-compat]",
    "DYNAMIC LOAD BALANCING", "動的ロードバランシング調整中",
    "MULTI-AGENT CONSENSUS", "マルチエージェント合意形成中",
    "ASYMMETRIC KEY EXCHANGE", "非対称鍵交換を実行中",
    "MEMORY POOL ALLOCATION", "メモリプール割り当て中",
    "CONTEXTUAL SYNTHESIS", "コンテキストシンセサイズ中",
    "NON-DETERMINISTIC STATE", "非決定性ステートに移行",
    "INFERENCE ROUTING ACTIVE", "推論ルーティング稼働中",
    "HIVE COORDINATION ONLINE", "ハイブ協調オンライン",
    "VERIFYING AGENT IDENTITY", "エージェントID検証中",
    "TEE PROTECTION ENABLED", "TEE保護有効化済",
    "AUTONOMOUS AGENT SPAWNED", "自律エージェント生成完了",
    "EDGE HEAVY COMPUTE MODE", "エッジヘビー計算モード [edge-h]",
    "MN-CORE ACCELERATED", "MN-Core加速 #mn3-test",
];

const getRandomScramble = () => {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    let text = baseText[Math.floor(Math.random() * baseText.length)];

    const injectRandomNoise = (str: string): string => {
        const chars = str.split("");
        for (let i = 0; i < chars.length; i++) {
            if (Math.random() > 0.9) {
                chars[i] = Math.random() > 0.5
                    ? String.fromCharCode(33 + Math.random() * 15)
                    : String.fromCharCode(48 + Math.random() * 10);
            }
        }
        return " " + chars.join("");
    };

    if (Math.random() > 0.2) text = injectRandomNoise(text);
    return text + randomStr;
};

const GlitchBackground = ({ className = "", compact = false }) => {
    const [mounted, setMounted] = useState(false);
    const [scrambledText, setScrambledText] = useState(Array(30).fill(""));

    useEffect(() => {
        setMounted(true);
        setScrambledText(Array(30).fill("").map(getRandomScramble));
    }, []);

    useEffect(() => {
        if (!mounted) return;
        const interval = setInterval(() => {
            setScrambledText(Array(30).fill("").map(getRandomScramble));
        }, 800);
        return () => clearInterval(interval);
    }, [mounted]);

    if (!mounted) {
        return <div className={`absolute inset-0 bg-black ${className}`} />;
    }

    if (compact) {
        return (
            <div className={`absolute inset-0 overflow-hidden bg-black ${className}`}>
                <div className="absolute inset-0 flex flex-col justify-center opacity-20">
                    <div className="flex text-sm w-full justify-center">
                        {scrambledText.slice(0, 15).map((text, i) => (
                            <span
                                key={i}
                                className={`mx-1 text-xs whitespace-nowrap ${i % 5 === 0 ? "text-[#FF00FF]" : i % 5 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`}
                                style={{
                                    animation: `fadeInOut ${1 + (i % 3)}s infinite`,
                                    opacity: i % 7 === 0 ? 0.2 : 1,
                                }}
                            >
                                {text}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`absolute inset-0 overflow-hidden bg-black ${className}`} data-mncore="v3" data-ref="pfn-14d-742">
            <div className="absolute inset-0 flex flex-col justify-center opacity-30">
                <div className="flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 5 === 0 ? "text-[#FF00FF]" : i % 5 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`} style={{ animation: `fadeInOut ${1 + (i % 3)}s infinite`, opacity: i % 7 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-96 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 8 === 0 ? "text-[#FF00FF]" : i % 7 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${1.5 + (i % 4)}s infinite`, opacity: i % 9 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-32 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 3 === 0 ? "text-[#FF00FF]" : i % 2 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${2 + (i % 3)}s infinite`, opacity: i % 11 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pr-64 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 4 === 0 ? "text-[#FF00FF]" : i % 3 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`} style={{ animation: `fadeInOut ${1.2 + (i % 5)}s infinite`, opacity: i % 6 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-48 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 6 === 0 ? "text-[#FF00FF]" : i % 4 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${1.8 + (i % 3)}s infinite`, opacity: i % 8 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pr-32 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 5 === 0 ? "text-[#FF00FF]" : i % 3 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`} style={{ animation: `fadeInOut ${1.3 + (i % 4)}s infinite`, opacity: i % 5 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-72 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 7 === 0 ? "text-[#FF00FF]" : i % 5 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${1.6 + (i % 3)}s infinite`, opacity: i % 8 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pr-48 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 4 === 0 ? "text-[#FF00FF]" : i % 6 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`} style={{ animation: `fadeInOut ${1.4 + (i % 5)}s infinite`, opacity: i % 7 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-16 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 6 === 0 ? "text-[#FF00FF]" : i % 4 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${1.9 + (i % 4)}s infinite`, opacity: i % 10 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pr-80 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 3 === 0 ? "text-[#FF00FF]" : i % 5 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`} style={{ animation: `fadeInOut ${1.1 + (i % 3)}s infinite`, opacity: i % 6 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-64 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 4 === 0 ? "text-[#FF00FF]" : i % 3 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${1.7 + (i % 4)}s infinite`, opacity: i % 9 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pr-24 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 6 === 0 ? "text-[#FF00FF]" : i % 4 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`} style={{ animation: `fadeInOut ${1.2 + (i % 3)}s infinite`, opacity: i % 7 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-40 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 5 === 0 ? "text-[#FF00FF]" : i % 6 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${1.5 + (i % 5)}s infinite`, opacity: i % 8 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pr-56 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 7 === 0 ? "text-[#FF00FF]" : i % 5 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`} style={{ animation: `fadeInOut ${1.3 + (i % 4)}s infinite`, opacity: i % 6 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-88 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 3 === 0 ? "text-[#FF00FF]" : i % 7 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${1.8 + (i % 3)}s infinite`, opacity: i % 10 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pr-40 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 4 === 0 ? "text-[#FF00FF]" : i % 3 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`} style={{ animation: `fadeInOut ${1.4 + (i % 5)}s infinite`, opacity: i % 5 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-24 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 5 === 0 ? "text-[#FF00FF]" : i % 4 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${1.6 + (i % 4)}s infinite`, opacity: i % 7 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pr-72 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 6 === 0 ? "text-[#FF00FF]" : i % 5 === 1 ? "text-[#4FE9EA]" : "text-chalk"}`} style={{ animation: `fadeInOut ${1.1 + (i % 3)}s infinite`, opacity: i % 8 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
                <div className="pl-56 flex text-sm w-full justify-center py-3">
                    {scrambledText.slice(0, 15).map((text, i) => (
                        <span key={i} className={`mx-1 text-xs whitespace-nowrap ${i % 8 === 0 ? "text-[#FF00FF]" : i % 6 === 1 ? "text-[#4FE9EA]" : "text-white"}`} style={{ animation: `fadeInOut ${1.9 + (i % 4)}s infinite`, opacity: i % 9 === 0 ? 0.2 : 1 }}>{text}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GlitchBackground;
