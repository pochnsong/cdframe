/***
 * cdframe 单页面应用框架 ES6
 */
(function () {
    const STYLE = `
    .pageX{height:100%; width:100%;position: absolute; left:0;top:0; overflow-x:hidden;z-index:-1;}
    @keyframes pageXShowleft{from {left: 100%;}to {left: 0;}} @keyframes pageXBackleft{from {left: 0;}to {left: 100%;}}
    @keyframes pageXShowright{from {left: -100%}to {left: 0;}} @keyframes pageXBackright{from {left: 0;}to {left: -100%;}}
    @keyframes pageXShowtop{from {top: -100%}to {top: 0;}} @keyframes pageXBacktop{from {top: 0;}to {top: -100%;}}`;

    const SETTINGS = {
        animation: ['left', 'right', 'top', null],
        lazy: [false, true]
    }
    function cfg(config, k, default_value){
        let v = config[k]===undefined?default_value:config[k]
        if(SETTINGS[k].includes(v)){
            return v
        }

        return SETTINGS[k][0]
    }
    function attr(obj, name, default_value) {
        
        let res = obj[name];
        if (res === undefined) {
            res = default_value
        }
        return res
    }

    var Http = {
        async get(url) {
            return new Promise(function (resolve, reject) {
                let xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.setRequestHeader('If-Modified-Since', '0');
                xhr.responseType = "text";
                xhr.onload = function () {
                    if (this.status == 200) {
                        resolve(this.response);
                    } else if (this.status == 404) {
                        resolve("");
                    }
                    else {
                        reject(this.response);
                    }
                }
                xhr.send();
            })
        },
    }

    var Compiler = {
        js: function (page, page_id) {
            //加载js
            let mod_name = page.path[page.path.length - 1]
            let load_name = page.js.slice(0, mod_name.length)
            if (load_name != mod_name) {
                console.error("加载JS错误 mod_name不匹配 " + mod_name + ':' + load_name)
                return null
            }
            eval(page_id + '_' + page.js); //初始化js
            return window[`${page_id}_${mod_name}`];
        }
    }

    class Pages {
        getAnimation(v) {
            if (SETTINGS.animation.includes(v)) {
                return v
            }
            return SETTINGS.animation[0]
        }
        config(pages, parents = []) {
            let res = {};

            for (let name in pages) {
                let o = pages[name];
                let path = parents.concat(name);
                let page_name = path.join('.')
                let src = path.join('/')
                res[page_name] = {
                    'path': path,
                    'name': page_name,
                    'load': false,
                    'html': '',
                    'js': '',
                    'css': '',
                    'settings': {
                        'html': attr(o, 'html', `${src}/page.html`),
                        'js': attr(o, 'js', `${src}/page.js`),
                        'css': attr(o, 'css', `${src}/page.css`),
                        'lazy': cfg(o, 'lazy', this.lazy),
                        'animation': cfg(o, 'animation', this.animation),
                    },
                }
                if (o.pages) {
                    let _res = this.config(o.pages, path)
                    for (let p in _res) {
                        res[p] = _res[p];
                    }
                }

            }
            return res
        }
        async load(page) {
            console.log('加载页面: ' + page.name);
            page.html = await Http.get(`${this.src}${page.settings.html}`)
            page.js = await Http.get(`${this.src}${page.settings.js}`)
            page.css = await Http.get(`${this.src}${page.settings.css}`)
            page.load = true

            let reg = /<fragment>(\w+)<\/fragment>/g;
            let matchs = page.html.match(reg)
            if(matchs!=null){
                for(let r of matchs){
                    let re = /<fragment>(\w+)<\/fragment>/;
                    let res = re.exec(r)
                    page.html = page.html.replace(r, this.fragments[res[1]])
                }    
            }

        }
        async load_framents(){
            for (let name in this.fragments) {
                this.fragments[name] = await Http.get(`${this.src}${this.fragments[name]}`);
            }    
        }

        async get(name) {
            let page = this.pages[name];
            if (!page.load) {
                await this.load(page)
            }
            return page
        }
        check(name){
            if(this.pages[name]){
                return true
            }
            return false

        }

        constructor(pages, fragments, src = "", animation = 'left', lazy=false) {
            this.src = src
            this.animation = this.getAnimation(animation)
            this.lazy = lazy
            this.fragments = fragments
            this.pages = this.config(pages)
        }

        async init() {
            await this.load_framents()
            for (let name in this.pages) {
                if(!this.pages[name].settings.lazy){
                    await this.get(name)
                }
            }
        }
    }
    var Dom = {
        initStyle(el) {
            let css = window.getComputedStyle(el);
            let width = css.width;
            let height = css.height;
            if (width == '0px') {
                el.style.width = '100vw'
            }
            if (height == '0px') {
                el.style.height = '100vh'
            }

            let _style = document.createElement("style");
            _style.innerHTML = STYLE;
            document.getElementsByTagName("head")[0].appendChild(_style);
            el.style.overflow = "hidden"
            el.style.position = "relative"
        },
        addStyle(id, content) {
            let el = document.createElement("style");
            el.id = id;
            el.innerHTML = content;
            document.getElementsByTagName("head")[0].appendChild(el);
        },
        addPage(el, id, html) {
            let div = document.createElement("div");
            div.className = "pageX"
            div.id = id;
            div.innerHTML = html;
            el.appendChild(div);
            return div;
        },
        $Id(id) {
            return document.getElementById(id)
        },
        removeElById(id) {
            let el = this.$Id(id);
            el.parentNode.removeChild(el)
        },
        removeElByClass(class_name) {
            let els = document.getElementsByClassName(class_name)
            for (let el of els) {
                el.parentNode.removeChild(el)
            }
        }
    }
    class CDFrame {
        //VERSION = 20210117
        getG(key) {
            let value = this.G[key];
            if (value) {
                delete this.G[key];
            }
            return value
        }
        getCurrentObj() {
            return this.objs[this.history[0]]
        }
        getPageName(name) {
            if(name.startsWith("..")){
                let obj = this.getCurrentObj()
                return name.replace("..", obj ? `${obj.path.slice(0, -2).join('.')}.` : "")
            }
            if (name.startsWith(".")) {
                let obj = this.getCurrentObj()
                return name.replace(".", obj ? `${obj.name}.` : "")
            }
            return name
        }
        async getPage(name) {
            return await this.pages.get(this.getPageName(name))
        }
        constructor(el, config) {
            this.el = Dom.$Id(el);
            Dom.initStyle(this.el);
            this.settings = {
                animation: cfg(config.settings, 'animation'),
                lazy: cfg(config.settings, 'lazy'),
                src: attr(config.settings, 'src', attr(config.settings, 'page_path', 'templates/')),
                onLoaded: attr(config.settings, 'onLoaded', function () { console.log("onLoaded") }),
            };
            this.pages = new Pages(
                config.pages, attr(config, 'fragments', {}),
                this.settings.src, this.settings.animation, this.settings.lazy);
            this.G = {};
            this.objs = {};
            this.current = null;
            this.lock = false; //事件锁定
            this.history = [];
            this.init()
        }
        async init() {
            await this.pages.init()
            this.settings.onLoaded.call(this);
        }

        destroy_page(page_id) {
            //销毁页面
            console.log('销毁', page_id);
            try {
                let obj = this.objs[page_id];
                delete this.objs[page_id]
                let mod_name = obj.name.split(".").pop()
                try{
                    obj.app.onStop && obj.app.onStop(obj.app)
                }catch(e){
                    console.error(e)
                }
                obj.app = undefined;
                delete window[`${page_id}_${mod_name}`]
                Dom.removeElById(page_id);
                Dom.removeElById(page_id + '_style');
            } catch (e) {
                console.error(e)
            }
        }
        async new_page(name, para, animation) {
            console.log('新页面 ', name, this.lock);
            let page = await this.getPage(name);
            if (!page) {
                console.warn("页面不存在: " + name)
                return
            }

            if (this.lock) { return }
            this.lock = true

            name = page.path.join('.')
            let page_id = 'page_' + (new Date()).valueOf();
            if (animation === undefined) { animation = page.settings.animation }

            let app = Compiler.js(page, page_id)
            if (app == null) {
                return
            }
            this.history.unshift(page_id);
            let obj = {
                'path': copy(page.path),
                'name': name,
                'page_id': page_id,
                'app': app,
                'animation': animation,
            };
            this.objs[page_id] = obj;
            Dom.addStyle(`${page_id}_style`, page.css); //添加css
            Dom.addPage(this.el, page_id, page.html);//添加dom

            try{
                this.current && this.current.onPause && this.current.onPause(this.current); 
            }catch(e){
                console.error(e)
            }
            try{
                app.onCreate && app.onCreate(app, page_id, para); //运行JS
            }catch(e){
                console.error(e)
            }

            this.current = app
            let page_dom = document.getElementById(page_id);
            page_dom.style.zIndex = this.history.length;


            //动画
            if (animation && this.history.length > 1) {
                let self = this;
                function animationEndFn() {
                    page_dom.removeEventListener("webkitAnimationEnd", animationEndFn);
                    self.lock = false;
                    app.onShow && app.onShow(obj.app);
                    self = undefined
                }
                page_dom.addEventListener("webkitAnimationEnd", animationEndFn)
                page_dom.style.animation = `pageXShow${animation} 0.3s`;

            } else {
                switch (animation) {
                    case 'top':
                        page_dom.style.top = 0;
                        break
                    case 'right':
                    default:
                        page_dom.style.left = 0;
                }
                Dom.removeElByClass("pageX reset-page-cover")
                app.onShow && app.onShow(app);
                this.lock = false
            }
            return page_id;

        }

        go_back(page_tag, animation) {
            //page_tag = page_id or page_name
            if (this.history.length == 1) {
                return
            }
            //console.log('go_back', page_tag)

            let page_id = this.history.shift()
            let obj = this.objs[page_id];
            let page_dom = Dom.$Id(page_id);
            obj.app.onPause && obj.app.onPause(obj.app)

            if (page_tag != undefined) {
                if (page_id != page_tag || obj.name != page_tag) {
                    while (this.history.length > 1) {
                        let _page_id = this.history[0];
                        let _obj = this.objs[_page_id];
                        if (_page_id === page_tag || _obj.name == page_tag) break;
                        this.history.shift();
                        this.destroy_page(_page_id);
                    }
                }

            }

            if (animation === undefined) { animation = obj.animation }

            this.current = this.objs[this.history[0]].app;

            if (animation) {
                page_dom.addEventListener("webkitAnimationEnd", () => {
                    this.destroy_page(page_id);
                    this.current.onShow && this.current.onShow(this.current);
                })
                page_dom.style.animation = 'pageXBack' + animation + ' 0.3s';

            } else {
                switch (animation) {
                    case 'top':
                        page_dom.style.top = '-100%';
                        break
                    case 'right':
                        page_dom.style.left = '-100%';
                        break
                    default:
                        page_dom.style.left = '100%';
                }
                this.destroy_page(page_id);
                this.current.onShow && this.current.onShow(this.current);
            }
        }
        reset_page(name, para) {
            //重置页面, 无动画
            name = this.getPageName(name)
            let page_id = this.history[0];
            let obj = this.objs[page_id];
            console.log("重置", name)
            if (obj.name == name) { 
                obj.app.onShow && obj.app.onShow(obj.app, para)
                return 
            }
            try{
                obj.app.onStop && obj.app.onStop(obj.app)
            }catch(e){
                console.error(e)
            }
            this.history.shift();
            this.destroy_page(page_id);

            //添加遮罩dom
            var div = document.createElement("div");
            div.classList.add("pageX", "reset-page-cover");
            div.style.backgroundColor = "#fff";
            div.style.zIndex = this.history.length;
            this.el.appendChild(div);
            this.new_page(name, para, null);
        }
        start_page(name, para) {
            //重置页面, 无动画
            while (self.history.length > 0) {
                let page_id = self.history.shift();
                self.destroy_page(page_id);
            }
            self.new_page(name, para, null);
        }
    }

    window.CDFrame = CDFrame;
    window.copy = function(v){
        return JSON.parse(JSON.stringify({_:v}))._
    }
})()
