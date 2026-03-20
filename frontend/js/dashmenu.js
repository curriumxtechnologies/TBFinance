      (function () {
        const menuToggle = document.getElementById("menuToggle");
        const mobileSidebar = document.getElementById("mobileSidebar");
        const closeSidebar = document.getElementById("closeSidebar");
        const overlay = document.getElementById("sidebarOverlay");
        const body = document.body;

        function openSidebar() {
          mobileSidebar.classList.add("open");
          overlay.classList.add("open");
          body.classList.add("mobile-menu-open");
        }

        function closeSidebarFunc() {
          mobileSidebar.classList.remove("open");
          overlay.classList.remove("open");
          body.classList.remove("mobile-menu-open");
        }

        if (menuToggle && mobileSidebar && closeSidebar && overlay) {
          // Open sidebar
          menuToggle.addEventListener("click", openSidebar);

          // Close with close button
          closeSidebar.addEventListener("click", closeSidebarFunc);

          // Close when clicking overlay
          overlay.addEventListener("click", closeSidebarFunc);

          // Close when clicking on any nav link (optional)
          mobileSidebar.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeSidebarFunc);
          });

          // Close with escape key
          document.addEventListener("keydown", (e) => {
            if (
              e.key === "Escape" &&
              mobileSidebar.classList.contains("open")
            ) {
              closeSidebarFunc();
            }
          });
        }
      })();