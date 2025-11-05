// アプリケーション
const app = {
    currentPage: 'home',
    currentPostId: null,
    currentEditId: null,
    filteredAuthor: null,
    searchQuery: '',
    pageNumber: 1,
    postsPerPage: 9,
    likes: {},
    views: {},
    data: {
        posts: []
    },
    db: null,

    // 初期化
    async init() {
        this.db = database;
        this.loadTheme();
        await this.loadData();
        
        this.setupRealtimeListeners();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
        this.render();
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    },

    // リアルタイム更新リスナー
    setupRealtimeListeners() {
        this.db.ref('posts').on('value', (snapshot) => {
            const posts = [];
            snapshot.forEach((childSnapshot) => {
                posts.push(childSnapshot.val());
            });
            posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            this.data.posts = posts;
            
            if (this.currentPage === 'home') {
                this.renderHome();
            } else if (this.currentPage === 'detail') {
                const currentPost = posts.find(p => p.id === this.currentPostId);
                if (currentPost) {
                    this.renderDetail();
                }
            } else if (this.currentPage === 'dashboard') {
                this.renderDashboard();
            }
        });

        this.db.ref('likes').on('value', (snapshot) => {
            this.likes = snapshot.val() || {};
            if (this.currentPage === 'home') {
                this.renderHome();
            } else if (this.currentPage === 'detail') {
                this.renderDetail();
            } else if (this.currentPage === 'dashboard') {
                this.renderDashboard();
            }
        });

        // 閲覧数の監視
        this.db.ref('views').on('value', (snapshot) => {
            this.views = snapshot.val() || {};
            if (this.currentPage === 'detail') {
                this.renderDetail();
            }
        });
    },

    // ルーティング処理
    handleRoute() {
        const hash = window.location.hash.slice(1) || '/';
        const [path, id] = hash.split('/').filter(Boolean);

        if (hash === '' || hash === '/') {
            this.goHome();
        } else if (path === 'new') {
            this.goNew();
        } else if (path === 'post' && id) {
            this.goDetail(id);
        } else if (path === 'dashboard') {
            this.goDashboard();
        } else {
            this.goHome();
        }
    },

    // ページ遷移
    goHome() {
        window.location.hash = '/';
        this.currentPage = 'home';
        this.currentEditId = null;
        this.filteredAuthor = null;
        document.getElementById('searchInput').value = '';
        document.getElementById('filterAuthorBtn').style.display = 'none';
        this.render();
    },

    goNew() {
        window.location.hash = '/new';
        this.currentPage = 'new';
        this.currentEditId = null;
        this.resetForm();
        this.render();
    },

    goDetail(id) {
        window.location.hash = `/post/${id}`;
        this.currentPage = 'detail';
        this.currentPostId = id;
        this.incrementViewCount(id);
        this.render();
    },

    goDashboard() {
        window.location.hash = '/dashboard';
        this.currentPage = 'dashboard';
        this.render();
    },

    // 閲覧数をインクリメント
    async incrementViewCount(postId) {
        try {
            const currentViews = this.views[postId] || 0;
            await this.db.ref('views/' + postId).set(currentViews + 1);
        } catch (error) {
            console.error('閲覧数更新エラー:', error);
        }
    },

    // ページ表示
    render() {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(this.currentPage).classList.add('active');

        if (this.currentPage === 'home') {
            this.renderHome();
        } else if (this.currentPage === 'detail') {
            this.renderDetail();
        } else if (this.currentPage === 'new') {
            this.renderNewForm();
        } else if (this.currentPage === 'dashboard') {
            this.renderDashboard();
        }
    },

    // ダッシュボードレンダリング
    renderDashboard() {
        const posts = this.data.posts;
        
        // チーム全体の統計
        const totalPosts = posts.length;
        const uniqueAuthors = [...new Set(posts.map(p => p.name))];
        const totalUsers = uniqueAuthors.length;
        const totalComments = posts.reduce((sum, post) => sum + (post.comments ? post.comments.length : 0), 0);
        const totalLikes = Object.values(this.likes).reduce((sum, count) => sum + count, 0);

        document.getElementById('totalPosts').textContent = totalPosts;
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalComments').textContent = totalComments;
        document.getElementById('totalLikes').textContent = totalLikes;

        // 最近の活動（最新5件）
        this.renderRecentActivities(posts.slice(0, 5));

        // 投稿数ランキング
        this.renderRanking(posts);

        // 投稿者別一覧
        this.renderAuthorsGrid(posts);
    },

    // 最近の活動
    renderRecentActivities(recentPosts) {
        const container = document.getElementById('recentActivities');
        container.innerHTML = '';

        if (recentPosts.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">まだ活動がありません</p>';
            return;
        }

        recentPosts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.onclick = () => this.goDetail(post.id);

            const timeAgo = this.getTimeAgo(new Date(post.createdAt));

            item.innerHTML = `
                <div class="activity-content">
                    <div class="activity-text">
                        <strong>${this.escapeHtml(post.name)}</strong> が投稿しました: 
                        「${this.escapeHtml(post.title)}」
                    </div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            `;

            container.appendChild(item);
        });
    },

    // 投稿数ランキング
    renderRanking(posts) {
        const container = document.getElementById('rankingList');
        container.innerHTML = '';

        // 投稿者ごとに集計
        const authorStats = {};
        posts.forEach(post => {
            if (!authorStats[post.name]) {
                authorStats[post.name] = {
                    name: post.name,
                    postCount: 0,
                    commentCount: 0,
                    likeCount: 0
                };
            }
            authorStats[post.name].postCount++;
            authorStats[post.name].commentCount += post.comments ? post.comments.length : 0;
            authorStats[post.name].likeCount += this.likes[post.id] || 0;
        });

        // 投稿数でソート
        const ranking = Object.values(authorStats).sort((a, b) => b.postCount - a.postCount);

        // TOP 10のみ表示
        ranking.slice(0, 10).forEach((author, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.onclick = () => this.filterByAuthor(author.name);

            const initial = author.name.charAt(0).toUpperCase();

            item.innerHTML = `
                <div class="ranking-number">${index + 1}</div>
                <div class="ranking-avatar">${initial}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${this.escapeHtml(author.name)}</div>
                    <div class="ranking-posts">
                        📝 ${author.postCount}件の投稿 | 
                        💬 ${author.commentCount}コメント | 
                        ❤️ ${author.likeCount}いいね
                    </div>
                </div>
                <div class="ranking-badge">${author.postCount}投稿</div>
            `;

            container.appendChild(item);
        });

        if (ranking.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">投稿がまだありません</p>';
        }
    },

    // 投稿者別一覧
    renderAuthorsGrid(posts) {
        const container = document.getElementById('authorsGrid');
        container.innerHTML = '';

        // 投稿者ごとにグループ化
        const authorPosts = {};
        posts.forEach(post => {
            if (!authorPosts[post.name]) {
                authorPosts[post.name] = [];
            }
            authorPosts[post.name].push(post);
        });

        // 投稿数でソート
        const sortedAuthors = Object.entries(authorPosts).sort((a, b) => b[1].length - a[1].length);

        sortedAuthors.forEach(([authorName, authorPostsList]) => {
            const card = document.createElement('div');
            card.className = 'author-card';

            const initial = authorName.charAt(0).toUpperCase();
            const postCount = authorPostsList.length;
            const totalComments = authorPostsList.reduce((sum, post) => sum + (post.comments ? post.comments.length : 0), 0);
            const totalLikes = authorPostsList.reduce((sum, post) => sum + (this.likes[post.id] || 0), 0);

            // 最新3件の投稿を表示
            const recentPosts = authorPostsList.slice(0, 3);
            const hasMore = authorPostsList.length > 3;

            card.innerHTML = `
                <div class="author-card-header">
                    <div class="author-avatar">${initial}</div>
                    <div class="author-info">
                        <div class="author-name">${this.escapeHtml(authorName)}</div>
                        <div class="author-stats">
                            ${postCount}件の投稿 · ${totalComments}コメント · ${totalLikes}いいね
                        </div>
                    </div>
                </div>
                <div class="author-posts-list">
                    ${recentPosts.map(post => {
                        const date = new Date(post.createdAt);
                        const shortDate = `${date.getMonth() + 1}/${date.getDate()}`;
                        return `
                            <div class="author-post-item" onclick="app.goDetail('${post.id}')">
                                <div class="author-post-title">${this.escapeHtml(post.title)}</div>
                                <div class="author-post-date">${shortDate}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${hasMore ? `<div class="author-show-more" onclick="app.filterByAuthor('${this.escapeHtml(authorName)}')">他${postCount - 3}件を見る →</div>` : ''}
            `;

            container.appendChild(card);
        });

        if (sortedAuthors.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">投稿者がまだいません</p>';
        }
    },

    // 時間差を人間が読める形式に
    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'たった今';
        if (minutes < 60) return `${minutes}分前`;
        if (hours < 24) return `${hours}時間前`;
        if (days < 7) return `${days}日前`;
        return this.formatDate(date);
    },

    // ホームページレンダリング
    renderHome() {
        const posts = this.getFilteredPosts();
        
        const totalPages = Math.ceil(posts.length / this.postsPerPage);
        
        if (this.pageNumber > totalPages && totalPages > 0) {
            this.pageNumber = totalPages;
        } else if (this.pageNumber === 0 && totalPages > 0) {
            this.pageNumber = 1;
        } else if (totalPages === 0) {
            this.pageNumber = 1;
        }
        
        const start = (this.pageNumber - 1) * this.postsPerPage;
        const end = start + this.postsPerPage;
        const paginatedPosts = posts.slice(start, end);

        const postsList = document.getElementById('postsList');
        postsList.innerHTML = '';

        if (paginatedPosts.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        document.getElementById('emptyState').style.display = 'none';

        paginatedPosts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'post-card';
            card.onclick = () => this.goDetail(post.id);

            const date = new Date(post.createdAt);
            const formattedDate = this.formatDate(date);

            card.innerHTML = `
                <div class="post-header">
                    <div>
                        <div class="post-author" onclick="event.stopPropagation(); app.filterByAuthor('${this.escapeHtml(post.name)}')">${this.escapeHtml(post.name)}</div>
                        <div class="post-date">${formattedDate}</div>
                    </div>
                </div>
                <h3 class="post-title">${this.escapeHtml(post.title)}</h3>
                <p class="post-preview">${this.escapeHtml(post.body)}</p>
                <div class="post-meta">
                    <div class="post-stats">
                        <span>💬 ${post.comments ? post.comments.length : 0}</span>
                        <span id="like-count-${post.id}">❤️ ${this.likes[post.id] || 0}</span>
                        <span>👁️ ${this.views[post.id] || 0}</span>
                    </div>
                </div>
            `;

            postsList.appendChild(card);
        });

        this.renderPagination(totalPages);
    },

    // ページネーション
    renderPagination(totalPages) {
        const pagination = document.getElementById('pagination');
        pagination.innerHTML = '';

        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← 前のページ';
        prevBtn.className = 'pagination-button';
        prevBtn.disabled = this.pageNumber === 1;
        prevBtn.onclick = () => {
            if (this.pageNumber > 1) {
                this.pageNumber--;
                this.renderHome();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
        pagination.appendChild(prevBtn);

        const startPage = Math.max(1, this.pageNumber - 2);
        const endPage = Math.min(totalPages, this.pageNumber + 2);

        if (startPage > 1) {
            const btn = document.createElement('button');
            btn.textContent = '1';
            btn.className = 'pagination-button';
            btn.onclick = () => {
                this.pageNumber = 1;
                this.renderHome();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            pagination.appendChild(btn);

            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.className = 'pagination-dots';
                pagination.appendChild(dots);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = this.pageNumber === i ? 'pagination-button active' : 'pagination-button';
            btn.onclick = () => {
                this.pageNumber = i;
                this.renderHome();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            pagination.appendChild(btn);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.className = 'pagination-dots';
                pagination.appendChild(dots);
            }

            const btn = document.createElement('button');
            btn.textContent = totalPages;
            btn.className = 'pagination-button';
            btn.onclick = () => {
                this.pageNumber = totalPages;
                this.renderHome();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            pagination.appendChild(btn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '次のページ →';
        nextBtn.className = 'pagination-button';
        nextBtn.disabled = this.pageNumber === totalPages;
        nextBtn.onclick = () => {
            if (this.pageNumber < totalPages) {
                this.pageNumber++;
                this.renderHome();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
        pagination.appendChild(nextBtn);
    },

    // 詳細ページレンダリング
    renderDetail() {
        const post = this.data.posts.find(p => p.id === this.currentPostId);
        if (!post) {
            this.goHome();
            return;
        }

        const date = new Date(post.createdAt);
        const formattedDate = this.formatDate(date);

        document.getElementById('detailTitle').textContent = post.title;
        document.getElementById('detailAuthor').textContent = post.name;
        document.getElementById('detailDate').textContent = formattedDate;
        document.getElementById('detailBody').textContent = post.body;
        
        // 閲覧数表示
        const viewCount = this.views[post.id] || 0;
        document.getElementById('detailViews').textContent = `👁️ ${viewCount}回閲覧`;

        const likeBtn = document.getElementById('likeBtn');
        if (this.likes[post.id]) {
            likeBtn.classList.add('liked');
        } else {
            likeBtn.classList.remove('liked');
        }

        this.renderComments(post.id);
    },

    // コメント表示
    renderComments(postId) {
        const post = this.data.posts.find(p => p.id === postId);
        const commentsList = document.getElementById('commentsList');
        const noComments = document.getElementById('noComments');

        commentsList.innerHTML = '';

        if (!post.comments || post.comments.length === 0) {
            noComments.style.display = 'block';
            return;
        }

        noComments.style.display = 'none';

        post.comments.forEach((comment, index) => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';

            const date = new Date(comment.createdAt);
            const formattedDate = this.formatDate(date);

            commentEl.innerHTML = `
                <div class="comment-header">
                    <div class="comment-author">${this.escapeHtml(comment.name)}</div>
                    <div class="comment-date">${formattedDate}</div>
                </div>
                <div class="comment-body">${this.escapeHtml(comment.body)}</div>
                <div class="comment-actions-small">
                    <button class="comment-delete-btn" onclick="app.deleteComment('${postId}', ${index})">削除</button>
                </div>
            `;

            commentsList.appendChild(commentEl);
        });
    },

    // 新規投稿フォームレンダリング
    renderNewForm() {
        const formTitle = document.getElementById('formTitle');
        const nameInput = document.getElementById('nameInput');
        const titleInput = document.getElementById('titleInput');
        const bodyInput = document.getElementById('bodyInput');

        if (this.currentEditId) {
            formTitle.textContent = '投稿を編集';
            const post = this.data.posts.find(p => p.id === this.currentEditId);
            if (post) {
                nameInput.value = post.name;
                titleInput.value = post.title;
                bodyInput.value = post.body;
            }
        } else {
            formTitle.textContent = '新規投稿';
            this.resetForm();
        }
    },

    // フォームリセット
    resetForm() {
        document.getElementById('postForm').reset();
        document.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.form-input, .form-textarea').forEach(el => el.classList.remove('error'));
    },

    // フォーム送信
    async handleSubmit(event) {
        event.preventDefault();

        const name = document.getElementById('nameInput').value.trim();
        const title = document.getElementById('titleInput').value.trim();
        const body = document.getElementById('bodyInput').value.trim();

        let isValid = true;
        if (!name) {
            this.showError('nameInput', 'nameError', '名前を入力してください');
            isValid = false;
        }
        if (!title) {
            this.showError('titleInput', 'titleError', 'タイトルを入力してください');
            isValid = false;
        }
        if (!body) {
            this.showError('bodyInput', 'bodyError', '概要・学びを入力してください');
            isValid = false;
        }

        if (!isValid) return;

        try {
            if (this.currentEditId) {
                const post = this.data.posts.find(p => p.id === this.currentEditId);
                if (post) {
                    const updatedPost = {
                        ...post,
                        name,
                        title,
                        body,
                        updatedAt: new Date().toISOString()
                    };
                    await this.db.ref('posts/' + this.currentEditId).set(updatedPost);
                    this.showToast('投稿を更新しました', 'success');
                }
            } else {
                const newPost = {
                    id: Date.now().toString(),
                    name,
                    title,
                    body,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    comments: []
                };
                await this.db.ref('posts/' + newPost.id).set(newPost);
                this.showToast('投稿を保存しました', 'success');
            }
            this.goHome();
        } catch (error) {
            console.error('投稿エラー:', error);
            this.showToast('投稿に失敗しました', 'error');
        }
    },

    // エラー表示
    showError(inputId, errorId, message) {
        const input = document.getElementById(inputId);
        const error = document.getElementById(errorId);
        input.classList.add('error');
        error.textContent = message;
        error.classList.add('show');
    },

    // 検索処理
    handleSearch() {
        this.searchQuery = document.getElementById('searchInput').value.toLowerCase();
        this.pageNumber = 1;
        this.renderHome();
    },

    // 作者でフィルタ
    filterByAuthor(author) {
        this.filteredAuthor = author;
        this.searchQuery = '';
        this.pageNumber = 1;
        document.getElementById('searchInput').value = '';
        document.getElementById('filterAuthorBtn').style.display = 'inline-block';
        this.goHome();
    },

    // フィルタクリア
    clearAuthorFilter() {
        this.filteredAuthor = null;
        this.pageNumber = 1;
        document.getElementById('filterAuthorBtn').style.display = 'none';
        this.renderHome();
    },

    // フィルタ済み投稿取得
    getFilteredPosts() {
        let posts = [...this.data.posts];

        if (this.filteredAuthor) {
            posts = posts.filter(p => p.name === this.filteredAuthor);
        }

        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            posts = posts.filter(p =>
                p.title.toLowerCase().includes(query) ||
                p.body.toLowerCase().includes(query) ||
                p.name.toLowerCase().includes(query)
            );
        }

        return posts;
    },

    // 投稿編集
    editPost() {
        this.currentEditId = this.currentPostId;
        this.goNew();
    },

    // 投稿削除
    deletePost() {
        document.getElementById('deleteModal').classList.add('active');
    },

    // 削除確認
    async confirmDelete() {
        try {
            await this.db.ref('posts/' + this.currentPostId).remove();
            await this.db.ref('likes/' + this.currentPostId).remove();
            await this.db.ref('views/' + this.currentPostId).remove();
            this.closeModal();
            this.showToast('投稿を削除しました', 'success');
            this.goHome();
        } catch (error) {
            console.error('削除エラー:', error);
            this.showToast('削除に失敗しました', 'error');
        }
    },

    // モーダルクローズ
    closeModal() {
        document.getElementById('deleteModal').classList.remove('active');
    },

    // いいねトグル
    async toggleLike() {
        try {
            const currentLikes = this.likes[this.currentPostId] || 0;
            const newLikes = currentLikes > 0 ? 0 : 1;
            
            if (newLikes > 0) {
                await this.db.ref('likes/' + this.currentPostId).set(newLikes);
            } else {
                await this.db.ref('likes/' + this.currentPostId).remove();
            }
        } catch (error) {
            console.error('いいねエラー:', error);
            this.showToast('いいねに失敗しました', 'error');
        }
    },

    // コメント追加
    async addComment() {
        const nameInput = document.getElementById('commentNameInput');
        const bodyInput = document.getElementById('commentBodyInput');

        const name = nameInput.value.trim();
        const body = bodyInput.value.trim();

        if (!name || !body) {
            this.showToast('名前とコメントを入力してください', 'error');
            return;
        }

        const post = this.data.posts.find(p => p.id === this.currentPostId);
        if (!post) return;

        try {
            const comments = post.comments || [];
            comments.push({
                name,
                body,
                createdAt: new Date().toISOString()
            });

            await this.db.ref('posts/' + this.currentPostId + '/comments').set(comments);
            
            nameInput.value = '';
            bodyInput.value = '';
            this.showToast('コメントを追加しました', 'success');
        } catch (error) {
            console.error('コメント追加エラー:', error);
            this.showToast('コメントの追加に失敗しました', 'error');
        }
    },

    // コメント削除
    async deleteComment(postId, index) {
        if (confirm('このコメントを削除しますか？')) {
            const post = this.data.posts.find(p => p.id === postId);
            if (post && post.comments) {
                try {
                    const comments = [...post.comments];
                    comments.splice(index, 1);
                    await this.db.ref('posts/' + postId + '/comments').set(comments);
                    this.showToast('コメントを削除しました', 'success');
                } catch (error) {
                    console.error('コメント削除エラー:', error);
                    this.showToast('コメントの削除に失敗しました', 'error');
                }
            }
        }
    },

    // トースト通知
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    // 日付フォーマット
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    
