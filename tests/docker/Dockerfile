FROM ubuntu:jammy

RUN apt-get update && apt-get install -y ssh
RUN mkdir /var/run/sshd
RUN useradd snailuser -m
RUN echo 'snailuser:mypassword' | chpasswd
EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]
