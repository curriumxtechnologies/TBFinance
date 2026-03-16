      (function () {
        // Initialize Lucide icons
        if (typeof lucide !== "undefined") {
          lucide.createIcons();
        }

        // Mobile menu functionality
        const menuToggle = document.getElementById("menuToggle");
        const mobileNav = document.getElementById("mobileNav");
        const body = document.body;

        if (menuToggle && mobileNav) {
          // Ensure starting state is closed
          mobileNav.classList.add(
            "invisible",
            "opacity-0",
            "-translate-y-full",
          );
          mobileNav.classList.remove("visible", "opacity-100", "translate-y-0");

          menuToggle.addEventListener("click", function (e) {
            e.stopPropagation();
            const isHidden = mobileNav.classList.contains("invisible");

            if (isHidden) {
              // Open menu
              mobileNav.classList.remove(
                "invisible",
                "opacity-0",
                "-translate-y-full",
              );
              mobileNav.classList.add(
                "visible",
                "opacity-100",
                "translate-y-0",
              );
              body.classList.add("mobile-menu-open");

              // Change icon to X
              const icon = menuToggle.querySelector("i");
              if (icon) {
                icon.setAttribute("data-lucide", "x");
                if (typeof lucide !== "undefined") lucide.createIcons();
              }
            } else {
              // Close menu
              mobileNav.classList.remove(
                "visible",
                "opacity-100",
                "translate-y-0",
              );
              mobileNav.classList.add(
                "invisible",
                "opacity-0",
                "-translate-y-full",
              );
              body.classList.remove("mobile-menu-open");

              // Change icon back to menu
              const icon = menuToggle.querySelector("i");
              if (icon) {
                icon.setAttribute("data-lucide", "menu");
                if (typeof lucide !== "undefined") lucide.createIcons();
              }
            }
          });

          // Close menu when clicking on a link
          mobileNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
              mobileNav.classList.remove(
                "visible",
                "opacity-100",
                "translate-y-0",
              );
              mobileNav.classList.add(
                "invisible",
                "opacity-0",
                "-translate-y-full",
              );
              body.classList.remove("mobile-menu-open");

              const icon = menuToggle.querySelector("i");
              if (icon) {
                icon.setAttribute("data-lucide", "menu");
                if (typeof lucide !== "undefined") lucide.createIcons();
              }
            });
          });

          // Close menu when clicking outside
          document.addEventListener("click", function (event) {
            if (
              !mobileNav.contains(event.target) &&
              !menuToggle.contains(event.target) &&
              !mobileNav.classList.contains("invisible")
            ) {
              mobileNav.classList.remove(
                "visible",
                "opacity-100",
                "translate-y-0",
              );
              mobileNav.classList.add(
                "invisible",
                "opacity-0",
                "-translate-y-full",
              );
              body.classList.remove("mobile-menu-open");

              const icon = menuToggle.querySelector("i");
              if (icon) {
                icon.setAttribute("data-lucide", "menu");
                if (typeof lucide !== "undefined") lucide.createIcons();
              }
            }
          });
        }

        // Re-run Lucide after any potential dynamic changes
        if (typeof lucide !== "undefined") {
          setTimeout(() => lucide.createIcons(), 100);
        }
      })();