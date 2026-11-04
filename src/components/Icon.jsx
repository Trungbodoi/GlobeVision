import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Database,
  Eye,
  EyeOff,
  GraduationCap,
  Globe2,
  Home,
  Keyboard,
  Languages,
  Layers3,
  Lightbulb,
  LockKeyhole,
  Map,
  MapPinned,
  Menu,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Route,
  Ruler,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  SunMedium,
  Timer,
  Trophy,
  UsersRound,
  X,
  Zap,
} from "lucide-react";

const ICONS = {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Database,
  Eye,
  EyeOff,
  GraduationCap,
  Globe2,
  Home,
  Keyboard,
  Languages,
  Layers3,
  Lightbulb,
  LockKeyhole,
  Map,
  MapPinned,
  Menu,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Route,
  Ruler,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  SunMedium,
  Timer,
  Trophy,
  UsersRound,
  X,
  Zap,
};

function Icon({
  name,
  label,
  size = 20,
  strokeWidth = 1.8,
  className,
}) {
  const IconComponent = ICONS[name];
  if (!IconComponent) throw new Error(`Unknown Lucide icon: ${name}`);

  return (
    <IconComponent
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      focusable="false"
      role={label ? "img" : undefined}
      size={size}
      strokeWidth={strokeWidth}
    />
  );
}

export default Icon;
