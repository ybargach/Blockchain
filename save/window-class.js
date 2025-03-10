export class Window {
    constructor(title, content, width = 500, height = 400) {
        this.title = title;
        this.content = content;
        this.width = width;
        this.height = height;
        this.isMinimized = false;
        this.isMaximized = false;
        this.previousState = null;
        this.isResizing = false;

        this.create();

        this.element.addEventListener('remove', () => {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            if (this.taskbarEntry && this.taskbarEntry.parentNode) {
                this.taskbarEntry.parentNode.removeChild(this.taskbarEntry);
            }
        });
    }

    async create() {
        const isMaximizable = this.title !== 'SuperPong' && this.title !== 'ticTacToe';
        this.element = document.createElement('div');
        this.element.className = 'window';
        this.element.style.width = this.width + 'px';
        this.element.style.height = this.height + 'px';
        this.element.style.minWidth = this.width + 'px';
        this.element.style.minHeight = this.height + 'px';
        
        // Set initial position to center without using transform
        const left = (window.innerWidth - this.width) / 2;
        const top = (window.innerHeight - this.height) / 2;
        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
        const tempContent = await this.content;
        this.element.innerHTML = `
            <div class="title-bar">
                <div class="title-bar-text">${this.title}</div>
                <div class="title-bar-controls">
                    <button aria-label="Minimize"></button>
                    ${isMaximizable ? '<button aria-label="Maximize"></button>' : ''}
                    <button aria-label="Close"></button>
                </div>
            </div>
            <div class="window-body">
                ${tempContent}
            </div>
        `;

        document.body.appendChild(this.element);
        this.createTaskbarEntry();

        // Add ResizeObserver to adjust size based on content
        this.resizeObserver = new ResizeObserver(entries => {
            if (this.isResizing) return;
            this.isResizing = true;

            for (let entry of entries) {
                const windowBody = this.element.querySelector('.window-body');
                if (entry.target === windowBody && !this.isMaximized) {
                    const contentWidth = entry.contentRect.width;  // Add padding
                    const contentHeight = entry.contentRect.height + 40;
                    const screenWidth = window.innerWidth - 40;  // Leave some margin
                    const screenHeight = window.innerHeight - 40;

                    // Check if content exceeds screen dimensions
                    if (contentWidth > screenWidth || contentHeight > screenHeight) {
                        console.log('Content exceeds screen dimensions');
                        // Content exceeds screen size, maximize the window
                        this.maximize();
                        windowBody.style.overflow = 'auto';
                        // windowBody.style.maxHeight = `${window.innerHeight - 60}px`; // Account for title bar
                    } else {
                        // Content fits, use normal sizing
                        const width = Math.max(contentWidth, this.width);
                        const height = Math.max(contentHeight, this.height);
                        
                        this.element.style.width = `${width}px`;
                        this.element.style.height = `${height}px`;
                        windowBody.style.overflow = 'visible';
                        windowBody.style.maxHeight = '';
                    }
                }
            }

            // Release the lock after a short delay
            setTimeout(() => {
                this.isResizing = false;
            }, 100);
        });
        
        // Start observing the window body
        const windowBody = this.element.querySelector('.window-body');
        this.resizeObserver.observe(windowBody);
        this.setupEventListeners();
    }

    createTaskbarEntry() {
        this.taskbarEntry = document.createElement('div');
        this.taskbarEntry.className = 'taskbar-item active';
        this.taskbarEntry.textContent = this.title;
        
        const taskbarItems = document.getElementById('taskbarItems');
        taskbarItems.appendChild(this.taskbarEntry);

        // Add wheel scroll handler if not already added
        if (!window.taskbarWheelHandler) {
            window.taskbarWheelHandler = true;
            taskbarItems.addEventListener('wheel', (e) => {
                e.preventDefault();
                taskbarItems.scrollLeft += e.deltaY;
            });
        }

        this.taskbarEntry.addEventListener('click', () => this.toggleMinimize());
    }
    handleResize() {
        // Get window dimensions
        const rect = this.element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight - 28; // Subtract taskbar height
    
        // Get current position
        let left = parseInt(this.element.style.left);
        let top = parseInt(this.element.style.top);
    
        // Check right edge
        if (left + rect.width > viewportWidth) {
            left = viewportWidth - rect.width;
        }
    
        // Check bottom edge
        if (top + rect.height > viewportHeight) {
            top = viewportHeight - rect.height;
        }
    
        // Check left edge
        if (left < 0) {
            left = 0;
        }
    
        // Check top edge
        if (top < 0) {
            top = 0;
        }
    
        // Apply new position
        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
    
        // Handle maximized state
        if (this.isMaximized) {
            this.element.style.width = '100%';
            this.element.style.height = `${viewportHeight}px`;
            this.element.style.left = '0';
            this.element.style.top = '0';
        }
    }

    setupEventListeners() {
        // Window dragging
        const titleBar = this.element.querySelector('.title-bar');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        titleBar.addEventListener('mousedown', (e) => {
            if (this.isMaximized) return;
            if (e.target === titleBar || e.target.classList.contains('title-bar-text')) {
                isDragging = true;
                const rect = this.element.getBoundingClientRect();
                initialX = e.clientX - rect.left;
                initialY = e.clientY - rect.top;
            }
        });

            // Add resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                
                // Calculate new position
                let newX = e.clientX - initialX;
                let newY = e.clientY - initialY;

                // Get viewport boundaries
                const maxX = window.innerWidth - this.element.offsetWidth;
                const maxY = window.innerHeight - this.element.offsetHeight;

                // Constrain to viewport
                if (newX < 0) newX = 0;
                if (newY < 0) newY = 0;
                if (newX > maxX) newX = maxX;
                if (newY > maxY) newY = maxY;

                this.element.style.left = `${newX}px`;
                this.element.style.top = `${newY}px`;
                this.element.style.transform = 'none'; // Remove any transform to ensure accurate positioning
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Window controls
        const controls = this.element.querySelector('.title-bar-controls');
        controls.querySelector('[aria-label="Minimize"]').onclick = () => this.minimize();
        controls.querySelector('[aria-label="Close"]').onclick = () => this.close();
        if (this.title !== 'SuperPong' && this.title !== 'ticTacToe') {
            controls.querySelector('[aria-label="Maximize"]').onclick = () => this.maximize();
        }

        // Tab system if content contains tabs
        const tabList = this.element.querySelector('menu[role="tablist"]');
        if (tabList) {
            const tabs = tabList.querySelectorAll('[role="tab"]');
            tabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchTab(tab);
                });
            });
        }
    }

    switchTab(selectedTab) {
        const tabs = this.element.querySelectorAll('[role="tab"]');
        const tabContents = this.element.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => tab.setAttribute('aria-selected', 'false'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        selectedTab.setAttribute('aria-selected', 'true');
        const contentId = selectedTab.querySelector('a').getAttribute('href').substring(1);
        const content = this.element.querySelector(`#${contentId}`);
        if (content) content.classList.add('active');
    }

    minimize() {
        this.isMinimized = !this.isMinimized;
        this.element.style.display = this.isMinimized ? 'none' : 'block';
        this.taskbarEntry.classList.toggle('active', !this.isMinimized);
    }

    maximize() {
        if(this.title === 'SuperPong' || this.title === 'ticTacToe') {
            return;
        }
        if (!this.isMaximized) {
            this.previousState = {
                width: this.element.style.width,
                height: this.element.style.height,
                left: this.element.style.left,
                top: this.element.style.top,
                transform: this.element.style.transform
            };
            this.isMaximized = true;
            
            const viewportHeight = window.innerHeight - 28;
            this.element.style.width = '100%';
            this.element.style.height = `${viewportHeight}px`;
            this.element.style.left = '0';
            this.element.style.top = '0';
            this.element.style.transform = 'none';
        } else {
            this.isMaximized = false;
            
            Object.assign(this.element.style, this.previousState);
            // Now handleResize will respect the non-maximized state
            this.handleResize();
        }
    }

    close() {
        if (this.title === 'ticTacToe')
        {
            console.log('Cleaning up ticTacToe connections...');
            window.clean_up();
        }
        if (this.title === 'SuperPong') {
			console.log('Cleaning up game connections...');
            if (window.MatchmakingSystem.isInQueue) {
                console.log('Canceling Queue');
                window.MatchmakingSystem.cancelQueue();
            }
			if (window.cleanupGameConnections) {
				window.cleanupGameConnections();
				console.log('Game connections cleaned up successfully');
			} else {
				console.warn('cleanupGameConnections function not found');
			}
            if (window.cleanupTournament) {
                window.cleanupTournament();
                console.log('Tournament cleaned up successfully');
            } else {
                console.warn('cleanupTournament function not found');
            }
		}
        this.element.remove();
        this.taskbarEntry.remove();
        // Notify DesktopManager to remove this window from its array
        window.desktopManager.removeWindow(this);
    }

    toggleMinimize() {
        this.minimize();
        if (!this.isMinimized) {
            this.element.style.zIndex = ++window.desktopManager.highestZIndex;
        }
    }
}