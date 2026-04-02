import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { useSidebar } from "./ui/sidebar";

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { state, isMobile } = useSidebar();
  const sidebarWidth = isMobile
    ? "0px"
    : state === "expanded"
      ? "var(--sidebar-width)"
      : "var(--sidebar-width-icon)";

  return (
    <div
      className="flex flex-col flex-1 h-full overflow-hidden transition-all duration-300"
      style={{
        marginLeft: sidebarWidth,
        width: `calc(100% - ${sidebarWidth})`,
        minWidth: 0,
      }}
    >
      <Header sidebarWidth={sidebarWidth} />
      <main className="flex-1 overflow-y-auto px-0 pt-14 md:pt-16">
        <div className="px-4 md:px-6 lg:px-8 py-6 mx-auto w-full max-w-8xl min-h-full flex flex-col">
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </main>
    </div>
  );
};
