/***
 * cdframe cordova 单页面应用框架
 * 依赖underscore.js
 * 依赖jquery.js
 * 
 * 
 */

var CDapp = $('.app');
var CDdata = {};

var CDpages = {
    /**
     * 保存页面page相关信息
     */
    pages:{},
    history:[],
    get_current:function(){
        return CDpages.history[CDpages.history.length-1];
    },
    back:function(){
        /**后退 */
        CDpages.history.pop();
        var history_obj = this.get_current();
        if(history_obj.cache){
            CDapp.html(history_obj.cache)        
        }else{
            CDapp.html(history_obj.page.page(history_obj.para))
        }
        console.log('back', CDpages.history)
    },
    goto:function(page_name, page_para){
        /**前进 */
        var page = CDpages.pages[page_name];
        var page_html = page.page(page_para);
        CDapp.html(page_html)
        
        CDpages.history.push({
            page:page,
            para:page_para,
            cache:page.settings.cache?page_html:null,
        })
        console.log('goto', CDpages.history)
    },
}

var CDframe = {
    init:function(config){
        /**
         * {
         *  login:{
         *      template:'http://site.com/tempal',
         *      lazy: true or false,
         *      cache: true or false,
         *      }
         * }
         * 
         */
        
        for(var page_name in config){
            var page_cfg = config[page_name];
            var page = {
                name:page_name,
                settings:{
                    src: page_cfg.template?page_cfg.template:"templates/"+page_name+'/'+page_name+'.html',
                    js:page_cfg.js?page_cfg.js:"templates/"+page_name+'/'+page_name+'.js',
                    css:page_cfg.css?page_cfg.css:"templates/"+page_name+'/'+page_name+'.css',
                    lazy: page_cfg.lazy?true:false,
                    cache:page_cfg.cache?true:false,
                },
                template: null,
                load:function(){
                    if(this.template === null){
                        $("<link>").attr({ rel: "stylesheet",type: "text/css",href: this.settings.css}).appendTo("head");
                        this.template = CDframe.get(this.settings.src);
                        CDframe.get(this.settings.js, "script");                      
                    }
                },
                page:function(page_para){
                    this.load()
                    var page_data = page_para;
                    if(CDctrl[this.name] && CDctrl[this.name].__init__!=undefined){
                        page_data = CDctrl[this.name].__init__(page_para);
                    }
                    
                    var res = page_data?CDframe._template(this.template, page_data): this.template;
                    return res;
                }
            }
            if(!page.settings.lazy){
                page.load()
            }

            CDpages.pages[page_name] = page;
        }
        return CDpages;

    },
    _template: function (temp_text, temp_data) {
        var _html = "";

        try{
            _html = _.template(temp_text)(temp_data);

        }catch (e) {
            console.log('_template error', e)
        }
        return _html
    },
    get:function(url, dataType){
        console.log('get', url)
        var response= $.ajax(
            {
                url:url,
                async: false,
                dataType:dataType,
                type: "GET",
                error:function(XHR, TS, e){
                    console.log('error get', url, TS, e)
                },
                complete: function(XHR, TS){
                    //console.log('finish', url, TS)
                    if(XHR.status != 200) {
                        console.log("complete", url, XHR, TS);
                    }
                }
            }
        );
        return response.responseText
    },

    post:function(url, dataType){
        var response= $.ajax(
            {
                url:url,
                async: false,
                dataType:dataType,
                type: "POST",
                complete: function(XHR, TS){
                    if(XHR.status != 200) {
                        console.log("complete", url, XHR, TS);
                    }
                }
            }
        );
        return response.responseText
    },
};

var CDctrl = {};


var Actions = {
    action: function (event, $this, action_name) {
        if($this===undefined){$this = $(this)}
        if(action_name===undefined){action_name = $this.data('action')}
        var fn_names = action_name.split('.');
        console.log(fn_names)
        var _fn=null; 
        switch(fn_names.length){
            case 0:
                break
            case 1:
                var page_name = CDpages.get_current().page.name;
                if(CDctrl[page_name] && CDctrl[page_name][action_name]!==undefined){
                    _fn = CDctrl[page_name][action_name]
                }else if(Actions[action_name] !== undefined){
                    _fn = Actions[action_name]
                }
                break
            default:
                var page_name = fn_names[0];
                if(CDctrl[page_name] && CDctrl[page_name][fn_names[1]]!==undefined){
                    _fn = CDctrl[page_name][fn_names[1]]
                }
                break
        }
        

        try{
            if(_fn === undefined){
                console.log('action undefined', action_name);
                return
            }
            _fn($this);
            event.stopPropagation();
        }catch (e){
            console.log('invalid action', action_name, e, _fn);
        }
    },
    click:function(event){
        var $this = $(this);
        console.log('click', $this, $this.data('click'))
        return Actions.action(event, $this, $this.data('click'))
    },
    goto:function($this){
        var page_para = $this.data();
        CDpages.goto(page_para['page'], page_para)
    },
    back:function(){
        CDpages.back();
    },
    extend:function (obj) {
        for(var k in obj){
            Actions[k] = obj[k]
        }
    }
};

$(document).ready(function () {
    $(document).on("click", "[data-click]", Actions.click);
});

_.templateSettings = {
    //interpolate: /\{\{(.+?)\}\}/g,
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /\{\{=([\s\S]+?)\}\}/g,
    escape      : /\{\{([\s\S]+?)\}\}/g
  };