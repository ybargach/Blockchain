export class DesktopIcon {
    constructor(name, x, y, content) {
        // Basic properties
        this.name = name;
        this.x = x;
        this.y = y;
        this.content = content;
        
        // State management
        this.isDragging = false;
        this.isSelected = false;
        this.element = null;
        this.dragOffset = { x: 0, y: 0 };
        this.lastClickTime = 0;
        
        // Create and initialize the icon
        this.create();
    }

    icon_images = {
        "Profile": "media/profile.png",
        "My Computer": "media/computer.png",
        "Friends": "media/friends.png",
        "SuperPong": "media/game1.png",
        "ticTacToe": "media/game2.png",
        "Tournaments": "media/trophy.png", // Add this line
    };

    create() {
        // Create main element
        this.element = document.createElement('div');
        this.element.className = 'desktop-icon';
        this.element.draggable = false; // Prevent default drag behavior
        
        // Set initial position
        this.updatePosition();

        // Create icon content
        this.element.innerHTML = `
        <div>
            <img src="${this.icon_images[this.name]}"  width="50" height="50" alt="${this.name}" />
        </div>
            <span>${this.name}</span>
        `;

        // Add to desktop
        document.getElementById('desktop').appendChild(this.element);

        // Setup event listeners
        this.setupEvents();
    }

    updatePosition() {
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
    }

    setupEvents() {
        // Mouse down - Start drag or selection
        this.element.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click only
                this.handleMouseDown(e);
            }
            // Prevent text selection during drag
            e.preventDefault();
        });

        // Click handler for selection and double-click
        this.element.addEventListener('click', (e) => {
            if (e.button === 0) { // Left click only
                this.handleClick(e);
            }
        });

        // Context menu
        this.element.addEventListener('contextmenu', (e) => {
            this.handleContextMenu(e);
        });

        // Global mouse move and up handlers
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.handleDrag(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.stopDragging();
            }
        });
    }

    handleMouseDown(e) {
        // Calculate offset for dragging
        const rect = this.element.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        // Start dragging
        this.isDragging = true;
        this.select();

        // Add dragging class for visual feedback
        this.element.classList.add('dragging');
    }

    handleClick(e) {
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - this.lastClickTime;

        if (timeSinceLastClick < 500) { // Double click threshold
            // Double click - open window
            this.openWindow();
        } else {
            // Single click - select
            this.select();
        }

        this.lastClickTime = currentTime;
    }

    handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();

        // Select the icon if not already selected
        if (!this.isSelected) {
            this.select();
        }

        // Show context menu
        const contextMenu = document.getElementById('desktopContextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.top = `${e.clientY}px`;
            
            // Store reference to this icon
            contextMenu.dataset.iconId = this.name;
        }
    }

    handleDrag(e) {
        if (!this.isDragging) return;

        // Calculate new position
        const desktop = document.getElementById('desktop');
        const desktopRect = desktop.getBoundingClientRect();
        
        let newX = e.clientX - this.dragOffset.x - desktopRect.left;
        let newY = e.clientY - this.dragOffset.y - desktopRect.top;

        // Constrain to desktop bounds
        const maxX = desktop.clientWidth - this.element.offsetWidth;
        const maxY = desktop.clientHeight - this.element.offsetHeight;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        // Update position
        this.x = newX;
        this.y = newY;
        this.updatePosition();
    }

    stopDragging() {
        this.isDragging = false;
        this.element.classList.remove('dragging');
    }

    select() {
        // Deselect all other icons
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            icon.classList.remove('selected');
        });

        this.isSelected = true;
        this.element.classList.add('selected');
    }

    deselect() {
        this.isSelected = false;
        this.element.classList.remove('selected');
    }
    /**********************************************************************
     *                    EXPERIMENTING AREA                           *
     * ================================================================== *
     *                    EXPERIMENTING AREA                           *
     * ================================================================== *
     *                    EXPERIMENTING AREA                           *
     **********************************************************************/


    openWindow() {
        // Create a new window using the desktop manager
        if (window.desktopManager) {
            if (typeof this.content === 'function') {
                window.desktopManager.createWindow(this.name, this.content);
            } else {
                // For backward compatibility with existing string content
                window.desktopManager.createWindow(this.name, () => Promise.resolve(this.content));
            }
        }
    }

    
    /**********************************************************************
     *                    EXPERIMENTING AREA                           *
     * ================================================================== *
     *                    EXPERIMENTING AREA                           *
     * ================================================================== *
     *                    EXPERIMENTING AREA                           *
     **********************************************************************/

    move(x, y) {
        this.x = x;
        this.y = y;
        this.updatePosition();
    }

    delete() {
        this.element.remove();
    }
}