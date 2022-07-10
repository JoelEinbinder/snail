//
//  ViewController.m
//  Terminal
//
//  Created by Joel Einbinder on 3/23/22.
//

#import "ViewController.h"
#import "NSObject+KVOBlock.h"

@implementation ViewController
- (void)viewDidLoad {
    [super viewDidLoad];
    nodeTalker = [[NodeTalker alloc] init];
    WKWebViewConfiguration* configuration = [[WKWebViewConfiguration alloc] init];
    [configuration.userContentController addScriptMessageHandler:self contentWorld:[WKContentWorld pageWorld] name:@"wkMessage"];
    webView = [[WKWebView alloc] initWithFrame:CGRectMake(0, 0, 200, 200) configuration:configuration];
    [webView setUIDelegate:self];
    webView.underPageBackgroundColor = [NSColor clearColor];
    [webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"http://localhost/gap-year/"]]];
    [webView setValue:@false forKey:@"drawsBackground"];
    self.view.window.title = webView.title;
    [webView observeKeyPath:@"title" withBlock:^(WKWebView* webView, NSString * keyPath, id lastValue) {
        webView.window.title = webView.title;
    }];
    webView.frame = self.view.bounds;
    [webView setAutoresizingMask:NSViewWidthSizable | NSViewHeightSizable];
    __weak typeof(self) weakSelf = self;
    [nodeTalker setOnMessage:^(NSString* _Nonnull message) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSString* code = [NSString stringWithFormat:@"webkit_callback(%@)", message];
            __strong typeof(self) strongSelf = weakSelf;
            if (strongSelf)
                [strongSelf->webView evaluateJavaScript:code completionHandler:nil];
        });
    }];

    NSVisualEffectView *viewWithFX = [[NSVisualEffectView alloc] initWithFrame:self.view.bounds];
    viewWithFX.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    viewWithFX.translatesAutoresizingMaskIntoConstraints = YES;
    viewWithFX.material = NSVisualEffectMaterialFullScreenUI; // or NSVisualEffectMaterialMenu, or ..
    viewWithFX.blendingMode = NSVisualEffectBlendingModeBehindWindow; //NSVisualEffectBlendingModeWithinWindow
    [viewWithFX addSubview:webView];

    [self.view addSubview:viewWithFX];

}
-(void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    NSDictionary* body = message.body;
    if ([@"beep" isEqualTo:body[@"method"]]) {
        NSLog(@"beep !");
        [[[NSSound soundNamed:@"Tink.aiff"] copy] play];
    } else {
        [nodeTalker sendMessage:body];
    }
}

- (void)setRepresentedObject:(id)representedObject {
    [super setRepresentedObject:representedObject];

    // Update the view, if already loaded.
}


@end
