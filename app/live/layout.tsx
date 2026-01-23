export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, overflow: "hidden", background: "#000" }}>
      {children}
    </div>
  );
}
