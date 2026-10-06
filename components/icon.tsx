// The one Phosphor wrapper (DESIGN-SYSTEM.md 3.5). Icons come from the icon
// map only; weight is regular, or fill for the active tab and "on" toggles.
import {
  At,
  BookmarksSimple,
  Bell,
  CaretDown,
  CaretLeft,
  ChatCircle,
  Check,
  DotsThree,
  EyeSlash,
  GoogleLogo,
  Images,
  GearSix,
  LinkSimple,
  LockSimple,
  MagnifyingGlass,
  MonitorPlay,
  PaperPlaneRight,
  PencilSimple,
  Plus,
  Question,
  Robot,
  ShareNetwork,
  SignOut,
  Trash,
  UserCircle,
  UserPlus,
  UsersThree,
  WarningCircle,
  WifiSlash,
  X,
  ArrowSquareOut,
} from "@phosphor-icons/react/dist/ssr";

export const icons = {
  add: Plus,
  vouched: Check,
  search: MagnifyingGlass,
  close: X,
  back: CaretLeft,
  switcher: CaretDown,
  share: ShareNetwork,
  copyLink: LinkSimple,
  settings: GearSix,
  group: UsersThree,
  friends: UserPlus,
  activity: Bell,
  more: DotsThree,
  whereToWatch: MonitorPlay,
  list: BookmarksSimple,
  you: UserCircle,
  private: LockSimple,
  edit: PencilSimple,
  remove: Trash,
  error: WarningCircle,
  offline: WifiSlash,
  help: Question,
  robot: Robot,
  signOut: SignOut,
  comment: ChatCircle,
  mention: At,
  spoiler: EyeSlash,
  send: PaperPlaneRight,
  google: GoogleLogo,
  screenshots: Images,
  // External links that open a new tab (DS 4.1.3)
  external: ArrowSquareOut,
} as const;

export type IconName = keyof typeof icons;

export type IconProps = {
  name: IconName;
  /** 16 inline with caption, 20 default, 24 in the tab bar and top bar. */
  size?: 16 | 20 | 24;
  weight?: "regular" | "fill";
  /** Icon-only meaning. Omit when the icon sits next to text (it's then hidden). */
  label?: string;
  className?: string;
};

export function Icon({ name, size = 20, weight = "regular", label, className }: IconProps) {
  const Component = icons[name];
  return (
    <Component
      size={size}
      weight={weight}
      color="currentColor"
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    />
  );
}
