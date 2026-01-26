export default function DreamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#000" }}>
      {children}
    </div>
  );
}
