/***
 * cdframe 单页面应用框架
 * 2022-01-20 tested on android 6.0
 */
"use strict"
; (function () {
    var STYLE = ".pageX{height:100%; width:100%;background-color:#fff;position: absolute; left:0;top:0; overflow-x:hidden;z-index:-1;}" +
        "@keyframes pageXShowleft{from {left: 100%;}to {left: 0;}} @keyframes pageXBackleft{from {left: 0;}to {left: 100%;}}" +
        "@keyframes pageXShowright{from {left: -100%}to {left: 0;}} @keyframes pageXBackright{from {left: 0;}to {left: -100%;}}" +
        "@keyframes pageXShowtop{from {top: -100%}to {top: 0;}} @keyframes pageXBacktop{from {top: 0;}to {top: -100%;}}"+
        "@keyframes pageXShowbottom{from {top: 100%}to {top: 0;}} @keyframes pageXBackbottom{from {top: 0;}to {top: 100%;}}";

    var SETTINGS = {
        animation: ['left', 'right', 'top', 'bottom', null],
        lazy: [false, true],
    }
    function cfg(config, k, default_value) {
        var v = config[k]
        if (SETTINGS[k].indexOf(v) > -1) {
            return v
        }
        if(default_value!=undefined){
            return default_value
        }
        return SETTINGS[k][0]
    }
    function attr(obj, name, default_value) {
        return (obj[name] !== undefined) ? obj[name] : default_value;
    }

    function copy(val) {
        return JSON.parse(JSON.stringify({ _: val }))._
    }
    function FnQueue(context){
        var self = this;
        self.queue = []
        self.lock = false
        self.next = function () {
            while (self.queue.length > 0) {
                var obj = self.queue.shift();
                var fn = obj[0], async = obj[1], para = obj[2];
                self.lock = true;
                try {
                    fn.apply(context, para);
                } catch (e) {
                    console.error(e)
                    self.lock = false;
                }
                if (async) {
                    return;
                }
            }
            self.lock = false;
        },
        self.call = function (fn, para, async) {
            self.queue.push([fn, async, para]);

            if (!self.lock) {
                self.next()
            }
        },
        self.clean = function () {
            //取消剩余队列
            self.queue = [];
        }

    }

    var Http = {
        get(url, callback, context) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = "text";
            xhr.setRequestHeader('If-Modified-Since', '0');

            xhr.onload = function () {
                if (this.status == 200) {
                    callback.call(context, this.response);
                }else {
                    console.error(this.response)
                    callback.call(context, "");
                }
            }
            xhr.send();
        },
    }

    var Compiler = {
        js:function(page, page_id) {
            //加载js
            var mod_name = page.path[page.path.length - 1]
            var load_name = page.js.slice(0, mod_name.length)
            if (load_name != mod_name) {
                console.error("加载JS错误 mod_name不匹配 " + mod_name + ':' + load_name)
                return null
            }
            eval("window."+page_id + '_' + page.js); //初始化js
            var app = window[page_id+'_'+mod_name];
            delete window[page_id+'_'+mod_name];
            return app
        }
    }

    function Pages(pages, src, animation, lazy) {
        var self= this;
        function config(pages, parents) {
            if (parents == undefined) parents = [];
            var res = {};

            for (var name in pages) {
                var o = pages[name];
                var path = parents.concat(name);
                var page_name = path.join('.')
                var _src = path.join('/')
                res[page_name] = {
                    'path': path,
                    'name': page_name,
                    'load': false,
                    'html': '',
                    'js': '',
                    'css': '',
                    'settings': {
                        'html': attr(o, 'html', src + _src + '/page.html'),
                        'js': attr(o, 'js', src + _src + '/page.js'),
                        'css': attr(o, 'css', src + _src + '/page.css'),
                        'lazy': cfg(o, 'lazy', lazy),
                        'animation': cfg(o, 'animation', animation),
                    },
                }
                if (o.pages) {
                    var _res = config(o.pages, path)
                    for (var p in _res) {
                        res[p] = _res[p];
                    }
                }

            }
            
            return res
        }
        self.src = src
        self.animation = animation
        self.lazy = lazy
        self.pages = config(pages)
        self.get = function (name) {
            return self.pages[name];
        }
    }

    var Dom = {
        create: function(tag) {
            return document.createElement(tag)
        },
        $:function(selector) {
            if (selector[0] == "#") {
                return [document.getElementById(selector.substr(1))]
            }
            if (selector[0] == '.') {
                return document.getElementsByClassName(selector.substr(1))
            }
            return document.getElementsByTagName("head")
        },
        init_style: function(el) {
            var css = window.getComputedStyle(el);
            var width = css.width;
            var height = css.height;
            if (width == '0px') {
                el.style.width = '100vw'
            }
            if (height == '0px') {
                el.style.height = '100vh'
            }

            var _style = Dom.create("style");
            _style.innerHTML = STYLE;
            Dom.$("head")[0].appendChild(_style);
            el.style.overflow = "hidden"
            el.style.position = "relative"
        },
        add_style: function (id, content) {
            var el = Dom.create("style");
            el.id = id;
            el.innerHTML = content;
            Dom.$("head")[0].appendChild(el);
        },
        add_div: function (el, id, html) {
            var div = Dom.create("div");
            div.className = "pageX"
            div.id = id;
            div.innerHTML = html;
            el.appendChild(div);
            return div;
        },
        remove_el: function (selector) {
            var els = Dom.$(selector)
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                //console.log(el, i, els)
                el.parentNode.removeChild(el)
            }
        },
        remove_el_by_class: function (class_name) {
            var els = document.getElementsByClassName(class_name)
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                //console.log(el, i, els)
                el.parentNode.removeChild(el)
            }
        }
    }
    window.CDFrame = function CDFrame(el, config) {
        var self = this;
        self.version = 20210514;
        self.VERSION = '1.2';
        self.el = Dom.$("#"+el)[0];
        Dom.init_style(this.el);
        self.lock = false; //事件锁定
        self.G = {};
        self.history = [];
        self.objs = {};
        self.current = null; //当前页面js对象
        //片段 1.1新增
        self.fragments = attr(config, 'fragments', [])
        self.settings = {
            animation: cfg(config.settings, 'animation'),
            lazy: cfg(config.settings, 'lazy'),
            src: attr(config.settings, 'src', attr(config.settings, 'page_path', 'templates/')),
            onLoaded: attr(config.settings, 'onLoaded', function () { console.log("onLoaded") }),
        };

        self.pages = new Pages(
            config.pages,
            self.settings.src,
            self.settings.animation, 
            self.settings.lazy);
        
        self.$core = {
            http: Http,
        }
        
        self.queue = new FnQueue(self);

        self.getG = function (key) {
            var value = self.G[key];
            if (value) {
                delete self.G[key];
            }
            return value
        }

        self.load_fragment = function (name, url) {
            self.queue.call(function (name, url) {
                console.log('加载片段: ' + name);
                Http.get(url, function (data) {
                    this.fragments[name] = data;
                    this.queue.next()
                }, self)
            }, [name, url], true)
        }

        self.load_template = function (name) {
            console.log('加载页面: ' + name);
            var page = self.pages.get(name)
            if (page.load) return;
            page.load = 'loading';

            self.queue.call(function (name) {
                var page = self.pages.get(name);
                Http.get(page.settings.html, function (data) {
                    var reg = /<fragment>(\w+)<\/fragment>/g;
                    if(reg.test(data)){
                        data = data.replace(reg, self.fragments[RegExp.$1])
                    }
                    page.html = data;
                    this.queue.next()
                }, self)
            }, [name], true)

            self.queue.call(function (name) {
                var page = self.pages.get(name);
                Http.get(page.settings.js, function (data) {
                    page.js = data;
                    this.queue.next()
                }, self)
            }, [name], true)

            self.queue.call(function (name) {
                var page = self.pages.get(name);
                Http.get(page.settings.css, function (data) {
                    page.css = data;
                    this.queue.next()
                }, self)
            }, [name], true)

            self.queue.call(function (name) {
                self.pages.get(name).load = true;
            }, [name], false)
        }

        self.destroy_page = function (page_id) {
            //销毁页面
            try {
                Dom.remove_el("#"+page_id);
                Dom.remove_el("#"+page_id + '_style');
                var obj = self.objs[page_id];
                delete self.objs[page_id]
                obj.app.onStop && obj.app.onStop()
                obj.app = undefined;

            } catch (e) {

            }
        }

        self.get_page_name=function(name){
            var obj = self.objs[self.history[0]]
            if(name.substr(0, 2)==".."){
                return name.replace("..", obj ? obj.path.slice(0, -2).join('.')+'.' : "")
            }
            if (name.substr(0, 1)=='.') {
                return name.replace(".", obj ? obj.name+'.' : "")
            }
            return name
        }

        self.new_page = function (name, para, animation) {
            
            console.log('打开新页面 ', name);
            name = self.get_page_name(name)

            var page = self.pages.get(name);
            if (!page) {
                console.warn("页面不存在: " + name)
                return
            }

            if (!page.load) {
                self.load_template(name);
                self.queue.call(self.new_page, [name, para, animation], false)
                return
            }
            if (self.lock) return
            self.lock = true
            var page_id = 'page_' + (new Date()).valueOf();
            if (animation === undefined) { animation = page.settings.animation }
            var app = Compiler.js(page, page_id)
            if (app == null) {
                return
            }
            self.history.unshift(page_id);
            var obj = {
                'path': copy(page.path),
                'name': name,
                'page_id': page_id,
                'animation': animation,
                'app': app,
            };
            self.objs[page_id] = obj;
            

            Dom.add_style(page_id + '_style', page.css); //添加css
            Dom.add_div(self.el, page_id, page.html);//添加dom
            self.current = app
            app.onCreate && app.onCreate(app, page_id, para); //运行JS

            var page_dom = Dom.$("#"+page_id)[0];
            page_dom.style.zIndex = self.history.length;

            //动画
            if (animation && self.history.length > 1) {
                function animationEndFn() {
                    this.removeEventListener("webkitAnimationEnd", animationEndFn);
                    self.lock = false;
                    app.onShow && app.onShow(app);
                }
                page_dom.addEventListener("webkitAnimationEnd", animationEndFn)
                page_dom.style.animation = 'pageXShow' + animation + ' 0.3s';

            } else {
                switch (animation) {
                    case 'top':
                        page_dom.style.top = 0;
                        break
                    case 'right':
                    default:
                        page_dom.style.left = 0;
                }
                Dom.remove_el_by_class("pageX reset-page-cover")
                app.onShow && app.onShow(app, para);
                self.lock = false
            }
            return page_id;

        }

        self.go_back = function (page_tag, animation) {
            //page_tag = page_id or page_name
            if (self.history.length == 1) {
                return
            }

            var page_id = self.history[0];
            var page_dom = Dom.$("#"+page_id)[0];
            var obj = self.objs[page_id];
            
            if (page_tag == undefined) {
                page_tag = page_id
            }
            if (animation === undefined) { 
                animation = obj.animation 
            }

            while (self.history.length > 1) {                
                var _page_id = self.history[0];
                var _obj = self.objs[page_id];
                if(_obj.app.onBack && !_obj.app.onBack(obj.app)){
                    return
                }            
                self.history.shift();
                if (_page_id == page_tag || _obj.name == page_tag){
                    break
                }
                self.destroy_page(_page_id);
            }
            if (animation) {

                page_dom.addEventListener("webkitAnimationEnd", function(){
                    self.destroy_page(page_id);
                    console.log("end", self.history)
                    self.current = self.objs[self.history[0]].app;
                    self.current.onShow && self.current.onShow(self.current);
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
                self.destroy_page(page_id);
                self.current = self.objs[self.history[0]].app;
                self.current.onShow && self.current.onShow(self.current);
            }
        }
        self.reset_page = function (name, para) {
            //重置页面, 无动画
            console.log("重置", name)
            name = self.get_page_name(name)

            var page_id = self.history[0];
            var obj = self.objs[page_id];
            if (obj.name == name) { return }
            this.history.shift();
            this.destroy_page(page_id);

            //添加遮罩dom
            var div = Dom.create("div");
            div.classList.add("pageX", "reset-page-cover");
            div.style.backgroundColor = "#fff";
            div.style.zIndex = self.history.length;
            this.el.appendChild(div);
            this.new_page(name, para, null);
        }

        self.start_page = function (name, para) {
            //重置页面, 无动画
            while (self.history.length > 0) {
                var page_id = self.history.shift();
                self.destroy_page(page_id);
            }
            self.new_page(name, para, null);
        }

        for (var name in self.fragments) {
            var url =  self.settings.src + self.fragments[name]
            self.load_fragment(name, url);
        }

        for (var name in self.pages.pages) {
            //console.log(name)
            if (!self.pages.get(name).settings.lazy) {
                self.load_template(name);
            }
        }

        self.queue.call(function () {
            self.settings.onLoaded.call(self);
        }, null, false)

    }
})();
