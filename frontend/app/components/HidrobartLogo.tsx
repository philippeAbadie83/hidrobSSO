export default function HidrobartLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">H</span>
      </div>
      <span className="font-bold text-xl text-gray-900">Hidrobart</span>
    </div>
  );
}
